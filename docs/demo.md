# MindCode: 3-Minute Demo Script

A concise, high-impact walkthrough designed for judges and teammates. Demonstrates how MindCode turns vague prompts into explicit, auditable architecture, generates a full-stack web application, and provides bidirectional traceability.

---

## Preparation & Setup (0:00 - 0:15)

1. **Start the local environment (or navigate to production):**
   - **Production:** Open [https://mindcode1.netlify.app/?demo=1](https://mindcode1.netlify.app/?demo=1)
   - **Local Development:** Run `MINDCODE_FAKE_LLM=1 npx netlify dev` and open [http://localhost:8888/?demo=1](http://localhost:8888/?demo=1)
2. **What `/?demo=1` loads:**
   - A pre-recorded real Claude Opus session: a collaborative study-group chat, full mind map with 8 bubbles (3 approved), a finished working build (`b1`), and historical checkpoints. No waiting on initial generation.

---

## 1. Facets & Assumption Color Coding (0:15 - 0:50)

- **Narration:**
  > "When you prompt Claude to build an app, it quietly makes dozens of architectural assumptions. Most tools hide these decisions in long conversational logs. MindCode exposes every single assumption as an editable visual mind map organized into four core facets: Design, Audience, Functionality, and Cost."
- **Point out in the Mind Map:**
  1. **Taxonomy Facets:** Show how the root decomposes into **Design**, **Audience**, **Functionality**, and **Cost**.
  2. **Your Words vs. Claude's Assumptions vs. Open Questions:**
     - **Orange (`user`, `#d67408`):** Sourced directly from user prompts (e.g. `Chat app`, `Study group`).
     - **Green Dashed (`inferred`, `#17c894`):** Features Claude assumed without being asked (e.g. `Message API`, `Real-time updates`).
     - **Inventiveness Shading:** Contrast pale green bubbles (obvious logical steps, low inventiveness) with deep green bubbles (creative leaps, high inventiveness).
     - **Red Outline with '?' (`unknown`):** Architectural questions Claude identified that need human resolution (e.g. `How do users log in?`).

---

## 2. Bubble Interaction: Path, Drawer, & Manual Editing (0:50 - 1:30)

- **Action:**
  1. Click on a bubble in the mind map (such as **`Message API`** or an open question).
  2. Notice the **breadcrumb path** at the top of the side panel showing its location in the hierarchy (e.g., `Chat app > Functionality > APIs > Message API`).
  3. Explore the **Side Panel Drawer**:
     - View the node's importance score, inventiveness rating, and supporting evidence quotes.
     - Demonstrate direct editing: edit the bubble's **Label** or **Detail** text directly.
  4. Click **+ Add child** to attach a new requirement or constraint bubble under the selected node.

---

## 3. Incremental Rebuild: Update in ~20 Seconds (1:30 - 2:05)

- **Action & Narration:**
  > "Traditional code generation requires re-generating 30 to 50 kilobytes of code from scratch for every small adjustment, which takes minutes. With MindCode, when you make targeted edits to the map, it performs an incremental rebuild."
  1. Click **Update** (or **Rebuild**).
  2. Explain what happens under the hood:
     - The backend computes a `mapDiff` between checkpoints.
     - Because only small changes were made, MindCode runs in `incremental` mode, asking Claude for surgical `FIND/REPLACE` patches.
     - The app updates within ~20 seconds instead of over a minute, updating only the affected DOM elements and styles while preserving everything else.

---

## 4. Right-Click In-Preview Editing in ~7 Seconds (2:05 - 2:35)

- **Action & Narration:**
  > "You can also refine the generated app directly from the visual output."
  1. Move the cursor into the interactive sandboxed preview pane on the right.
  2. **Right-click** any UI element (for example, the primary action button or a header card).
  3. Notice the element is highlighted with an orange focus ring (`.mc-edit`) and the inline change drawer slides in with the element's tag, snippet, and linked bubbles.
  4. Enter a targeted change instruction:
     ```text
     Make this button deep purple with rounded corners and bold text
     ```
  5. Press **Submit Change**.
  6. In ~7 seconds, Claude returns a precise `FIND/REPLACE` patch applied directly to the HTML. The preview updates instantly with the new design!

---

## 5. Bidirectional Traceability, Standalone App & Checkpoints (2:35 - 3:00)

- **Action:**
  1. **Hover Traceability:**
     - Hover over an element in the preview (such as the chat message stream or header) to see the informing mind map bubbles light up.
     - Click a bubble in the mind map to outline all corresponding DOM components in the preview.
  2. **Open App ↗:**
     - Click **Open app ↗** in the preview toolbar.
     - Point out that this opens a standalone, clean version of the generated application in a new browser tab without development overlays or parent iframe constraints.
  3. **Checkpoints:**
     - Click the checkpoint markers along the timeline bar at the top/bottom.
     - Show how you can inspect the exact state of the mind map at earlier points in time, or restore previous versions.

- **Closing Remark:**
  > "MindCode gives developers and domain experts the speed of Claude with the transparency of a visual specification—every element in production traces directly back to a human decision."
