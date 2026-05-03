# Syntax Swarm

Syntax Swarm is a high-octane, glitch-themed arcade game where you play as a system architect fighting against a relentless wave of corrupted syntax. Set in a world of terminal-inspired visuals and procedural audio, it challenges your reflexes and system management skills.

## 💾 The Story
A catastrophic kernel overflow has triggered a "Syntax Swarm." Corrupted data blocks are flooding the cache, threatening to destabilize the entire OS. Your mission is to purge these anomalies, stabilize the syntax, and reach the final compilation before the system hits a critical breakdown.

## 🎮 How to Play
- **Objective**: Purge a specific number of corrupted nodes in each level to advance.
- **Controls**:
  - **Click/Tap**: Purge a targeted anomaly. 
  - **Mute Toggle**: Control the "System Audio" if the glitch noise becomes too intense.
  - **Settings**: Adjust system parameters mid-game (accessible from the main game screen).
- **Levels**: The swarm gets faster and more erratic with every level. Complete 10 levels to reach "Compilation Success."
- **Game Over**: If the timer runs out before the purge quota is met, the system crashes and enters a `SYSTEM_DANGER` state.

## 🛠️ Built With
- **Framework**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for that sharp, harsh terminal aesthetic.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (`motion/react`) for glitch filters, CRT flickering, and layout transitions.
- **Audio Engine**: Procedural synthesis using the **Web Audio API** — the soundtrack is synthesized in real-time.
- **Icons**: [Lucide React](https://lucide.dev/).

## 🚀 Running the Project Locally
To run **Syntax Swarm** on your own machine:

1. **Clone the Repo**:
   ```bash
   git clone <your-repo-url>
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Engine**:
   ```bash
   npm run dev
   ```
4. **Access**: Open your browser to the local port (usually `http://localhost:3000`).

---

### All rights to project reserved to ~Tanay Pandey
**Built using AIStudio.Google**

---
*STATUS: COMPILATION SUCCESSFUL. RUNTIME STABLE.*
