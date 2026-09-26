This solution keeps **all functionality** (Sync, Add, End Day, Log, View Modes) but reorganizes them using **Common Region** and **Visual Hierarchy** principles to remove the clutter.

### 🎨 Design Concept: The "Control Bar"

Instead of scattering buttons everywhere, we consolidate actions into a single, floating **Control Bar**. Secondary actions (Sync, End Day) become icon-only buttons to save space, while the primary action (Log) remains prominent.

### 🖥️ UI Mockup

```text
+----------------------------------------------------------------------------------+
|  [Sidebar Hidden]                                                                |
|                                                                                  |
|  DAILY LOG                                            Total: 5h 12m · 1 Pending  |
|  <  Today, Oct 24  >                                                             |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  +----------------+                                     +---------------+  |  |
|  |  | List  Timeline |                                     | Log 1 Item  → |  |  |
|  |  +----------------+                                     +---------------+  |  |
|  |                                                                            |  |
|  |   [+] Add Entry    [🔄] Sync    [🌙] End Day    [⋮] Select                 |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  ------------------------------------------------------------------------------  |
|  | 10:19   ●  [Checkmark]   Admin Work                               15m      |  |
|  |         |                #229602 · Billable                                |  |
|  ------------------------------------------------------------------------------  |
|  | 10:34   ●  [Checkmark]   Analysis after client meeting            25m      |  |
|  |         |                #667776 · Billable                                |  |
|  ------------------------------------------------------------------------------  |
+----------------------------------------------------------------------------------+

```

### 🔧 Key Changes:

1. **The Header:** Simplified to just the Title and Date Navigator. The "Stats" (Time/Count) are moved to the right as plain text, removing the heavy boxes.
2. **The Command Bar (The Toolbar):**
* **View Toggle:** A simple segmented control on the left (`List | Timeline`).
* **Primary Action:** "Log 1 Item" is the only solid, colored button (Accent Color). It draws the eye immediately.
* **Secondary Actions:** "Add", "Sync", and "End Day" are now **Ghost Buttons** (Icon + Label or just Icon) on a secondary row or grouped with the primary action. This reduces the "rainbow of buttons" effect.


3. **Visual Noise Reduction:** Removed the "Quick Log: Admin/Meeting" colored badges from the top. These can be moved inside the "+ Add Entry" modal or a dropdown to clean up the interface.
4. **Timeline Integration:** The list items now incorporate the "Timeline Node" look we discussed earlier (Time on left, line connecting them).

This approach maintains the **Dark/Zen aesthetic** while ensuring every button you had before is still accessible, just prioritized better.