# MonoCloud

**“Visual architecture for your monorepo”**

MonoCloud is an immersive 3D tool to explore, understand, and narrate the structure of any codebase. Inspired by Figma-like interfaces and sci-fi visual language, it turns your repository into a floating network of translucent glass-like modules — each one connected with animated curves and capable of speaking its own purpose through AI-generated narration.

---

## 🚀 Features

- 🔍 **3D Module Visualization**  
  Modules are displayed as semi-transparent cubes connected by animated curved lines in a dynamic spatial layout.

- 🎤 **AI-Powered Speech**  
  Click on any cube and hear it describe itself using OpenAI’s `tts-1` voice model, adding an immersive and informative layer.

- ⚙️ **Codebase Analysis**  
  Built-in graph logic parses dependencies and renders their relationships visually in real time.

- 🧠 **Fast & Magical**  
  Preprocessing is done server-side, so analysis feels instant. If you revisit the same repo, it's served from cache — fast as thought.

- 🌗 **Dark/Light Mode Support**  
  Designed with smooth visuals, soft gradients, and a cinematic glow for both themes.

---

## 🛠️ Tech Stack

- [Next.js 15](https://nextjs.org/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [OpenAI TTS (`gpt-4o-mini-tts`)](https://platform.openai.com/docs/guides/text-to-speech)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 📦 Usage

Paste the public GitHub URL of a repo (or modify the internal logic to analyze a local one), and the graph will be generated and narrated.


---

## 🌟 Inspiration

- The speed of [Grep](https://vercel.com/blog/vercel-acquires-grep)
- The beauty of [Figma’s UI design model](https://www.figma.com/)
- The architecture of Next.js apps
- The dream of making codebases feel alive

---

## 🧪 Status

Hackathon MVP — in progress. Voice integration, dynamic parsing, and visual polish complete. Next: repo upload support, dependency depth layers, and AI summaries for each module.

---

## ✨ License

MIT — free to build on.

