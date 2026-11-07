# Demo Script (Under 3 Minutes)

The exact clicks, narration, and flow for judges. Verified end-to-end with `MINDCODE_FAKE_LLM=1`.

## Setup (5 s)
1. Run `MINDCODE_FAKE_LLM=1 npx netlify dev` (or `$env:MINDCODE_FAKE_LLM="1"; npx netlify dev` on Windows PowerShell).
2. Open **http://localhost:8888** in your browser.

---

## 1. Pitch & First Message (0:00 - 0:40)
- **Narration (20 s):**
  > "When you build with an LLM, it quietly makes dozens of unvetted assumptions. When something goes wrong, you're left scrolling back through thousands of tokens. MindCode shows you every single assumption as an interactive structure you can see, edit, and approve before the code is generated."
- **Action (20 s):**
  In the left chat pane, type:
  ```text
  I want a chat app for my study group
  ```
  and press **Enter** (or click **Send**).

---

## 2. Live Mind Map & Source Colors (0:40 - 1:15)
- **Visual Callouts:**
  The center pane animates 5 connected bubbles:
  1. **Solid Blue (`user`):** `Chat app` (root) and `Study group`. These came directly from your words.
  2. **Amber Dashed (`inferred`):** `Message API` and `Real-time updates`. Claude assumed these capabilities.
  3. **Inventiveness Shading:** Point out that `Message API` is pale amber (obvious necessity, low inventiveness: 0.2), while `Real-time updates` is deep amber (creative design leap, high inventiveness: 0.85).
  4. **Red Outline with '?' (`unknown`):** `How do users log in?`. Claude detected that a critical architectural decision was left unspecified.

---

## 3. Brainstorming & Approving a Bubble (1:15 - 1:50)
- **Action:**
  1. Click on the red bubble **`How do users log in?`**.
  2. In the bubble chat drawer, type:
     ```text
     just a nickname, no passwords
     ```
     and press **Enter**.
  3. Claude responds confirming the change and rewrites the bubble label to **`Nickname login`**.
  4. Click the green **Approve** button.
  5. The bubble turns green with a checkmark (**✓ Approved**).

---

## 4. Build with Bidirectional Traceability (1:50 - 2:30)
- **Action:**
  1. Click **⚡ Build App** in the top-right of the preview pane.
  2. Within seconds, the generated application appears in the interactive sandboxed preview.
- **Traceability Highlights:**
  - **Page to Bubbles:** Hover over the page title **`Study Group Chat`** in the preview. Notice the `Chat app` and `Study group` bubbles in the center pane instantly light up!
  - **Bubble to Page:** Click or select the **`Nickname login`** bubble in the mind map. Notice the **Join Study Group** login card in the preview is outlined!
  - Every component in the generated HTML contains traceable metadata (`data-mc` / `data-mc-el`) linking it back to the exact requirements that shaped it.

---

## 5. Checkpoints & Close (2:30 - 2:50)
- **Action:**
  1. Click an earlier checkpoint in the timeline to view the original mind map before the login approval.
- **Closing Remark (20 s):**
  > "With MindCode, users keep their natural language workflow, while Claude is forced to expose its hidden reasoning as an auditable structure. When you approve the structure, the resulting code is fully traceable to your decisions."

**Total Demo Time:** 2 minutes 50 seconds (under the 3-minute limit).
