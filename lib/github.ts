import { Octokit } from "octokit"

// Initialize Octokit with the GitHub token
const getOctokit = () => {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error("GitHub token not found. Please add a GITHUB_TOKEN environment variable.")
  }
  return new Octokit({ auth: token })
}

export async function parseGitHubUrl(url: string) {
  // Handle formats like:
  // https://github.com/owner/repo
  // github.com/owner/repo
  // owner/repo

  let owner, repo

  try {
    if (url.includes("github.com")) {
      const parts = url.split("github.com/")[1].split("/")
      owner = parts[0]
      repo = parts[1]?.split("#")[0]?.split("?")[0] // Remove any hash or query params
    } else if (url.includes("/")) {
      const parts = url.split("/")
      owner = parts[0]
      repo = parts[1]?.split("#")[0]?.split("?")[0] // Remove any hash or query params
    }

    if (!owner || !repo) {
      throw new Error("Invalid GitHub repository URL format")
    }

    return { owner, repo }
  } catch (error) {
    console.error("Error parsing GitHub URL:", error)
    throw new Error("Failed to parse GitHub URL. Please use format: owner/repo")
  }
}

export async function fetchRepoTree(owner: string, repo: string) {
  const octokit = getOctokit()

  try {
    // Get the default branch
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    })

    const defaultBranch = repoData.default_branch

    // Get the tree recursively
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "1",
    })

    // Filter for package.json files
    return treeData.tree
      .filter((item) => item.path.endsWith("package.json"))
      .map((item) => ({
        path: item.path,
        sha: item.sha,
      }))
  } catch (error: unknown) {
    console.error("Error fetching repo tree:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    throw new Error(`Failed to fetch repository tree: ${errorMessage}`)
  }
}

// Add delay between API calls to avoid rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchFileContent(owner: string, repo: string, path: string) {
  const octokit = getOctokit()

  try {
    // Add a small delay to avoid hitting rate limits
    await delay(100)

    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    })

    // GitHub API returns content as base64 encoded
    if ("content" in data && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8")
    }

    throw new Error("Unexpected response format from GitHub API")
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && error.status === 403 && error.message.includes("rate limit")) {
      throw new Error("GitHub API rate limit exceeded. Please try again later.")
    }

    if (error instanceof Error && 'status' in error && error.status === 429) {
      throw new Error("Too many requests to GitHub API. Please try again later.")
    }

    console.error(`Error fetching file content for ${path}:`, error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    throw new Error(`Failed to fetch file content: ${errorMessage}`)
  }
}

export async function analyzeRepoGraph(owner: string, repo: string) {
  // Limit the number of package.json files to analyze to avoid rate limits
  const MAX_FILES = 20

  try {
    console.log(`Analyzing repository graph for ${owner}/${repo}`)
    const packageFiles = await fetchRepoTree(owner, repo)
    console.log(`Found ${packageFiles.length} package.json files, analyzing up to ${MAX_FILES}`)

    const limitedFiles = packageFiles.slice(0, MAX_FILES)

    // Create arrays for nodes and connections
    const nodes = []
    const edges = []
    const moduleMap = new Map()

    // Process each package.json file
    for (const file of limitedFiles) {
      try {
        // Extract module name from file path
        const pathParts = file.path.split("/")
        // Use parent directory as module name, or "root" if in the root
        const moduleName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : "root"

        console.log(`Processing package.json for module: ${moduleName}, path: ${file.path}`)

        // Get and parse package.json content
        const packageJson = await fetchFileContent(owner, repo, file.path)
        const pkg = JSON.parse(packageJson)

        // Add node to graph
        nodes.push({
          id: moduleName,
          label: moduleName,
          data: {
            path: file.path,
            pkg,
            packageJson, // Save original JSON for later analysis
          },
        })

        // Save dependencies in module map
        moduleMap.set(moduleName, {
          name: moduleName,
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {}),
        })
      } catch (error) {
        if (error instanceof Error && error.message && (error.message.includes("rate limit") || error.message.includes("Too many requests"))) {
          throw error // Propagate rate limit errors
        }
        console.error(`Error processing package.json for ${file.path}:`, error)
      }
    }

    console.log(`Successfully processed ${nodes.length} modules`)

    // Find internal dependencies (within the same repository)
    for (const [sourceName, sourceData] of moduleMap.entries()) {
      // Check regular dependencies
      for (const dep of sourceData.dependencies || []) {
        if (moduleMap.has(dep)) {
          edges.push({
            source: sourceName,
            target: dep,
            type: "dependency",
          })
        }
      }

      // Also check devDependencies
      for (const dep of sourceData.devDependencies || []) {
        if (moduleMap.has(dep)) {
          edges.push({
            source: sourceName,
            target: dep,
            type: "devDependency",
          })
        }
      }
    }

    console.log(`Found ${edges.length} internal dependencies between modules`)

    // If no connections were found but there are nodes, create artificial connections
    // to make the visualization more interesting
    if (edges.length === 0 && nodes.length > 1) {
      console.log("No internal dependencies found, creating artificial connections for visualization")

      // Connect all modules to the first one as a fallback
      const firstModule = nodes[0].id
      for (let i = 1; i < nodes.length; i++) {
        edges.push({
          source: firstModule,
          target: nodes[i].id,
          type: "artificial", // Mark as artificial
        })
      }
    }

    return { nodes, edges }
  } catch (error) {
    console.error("Error in analyzeRepoGraph:", error)
    throw error
  }
}

export async function analyzeMonorepo(url: string) {
  // Parse the GitHub URL
  const { owner, repo } = await parseGitHubUrl(url)

  // Analyze the repository graph
  const graph = await analyzeRepoGraph(owner, repo)

  // If we couldn't find any nodes, throw an error
  if (graph.nodes.length === 0) {
    throw new Error("No package.json files found in the repository or failed to analyze them.")
  }

  return {
    owner,
    repo,
    graph,
  }
}
