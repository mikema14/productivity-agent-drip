# Drip UI Design System

## Design Principles

- **Transparent backgrounds**: Prefer `bg-transparent` over solid fills for inputs and containers
- **Orange (`focus`) accent color**: Every interactive element, border, and state indicator uses the `focus` token (amber/orange)
- **No grey glass remnants**: The old `glass-*` utility classes are deprecated in Timer-view files — use orange accent equivalents
- **Consistent rounding**: `rounded-xl` for inputs/buttons/cards, `rounded-2xl` for modals, `rounded-full` for pills/badges

---

## Token Reference

| Element | Tailwind Classes |
|---------|-----------------|
| **Input (resting)** | `bg-transparent border border-focus/30 rounded-xl` |
| **Input (focus ring)** | `focus:ring-2 focus:ring-focus/30 focus:border-focus/30` |
| **Primary button** | `bg-focus text-drip-bg rounded-2xl shadow-glow-focus hover:scale-[1.02]` |
| **Secondary button** | `px-4 py-2 bg-focus/10 border border-focus/20 text-focus rounded-xl hover:bg-focus/20` |
| **Ghost / neutral button** | `px-4 py-2 bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all` |
| **Destructive ghost** | `text-txt-dim hover:text-red-400 transition-colors` |
| **Toggle (active)** | `bg-focus/15 text-focus border border-focus/30` |
| **Toggle (inactive)** | `text-txt-secondary hover:text-txt-primary hover:bg-focus/5` |
| **Billable toggle** | Shared `BillableToggle` pill — active `bg-focus/15 text-focus border-focus/30` (with `✓`), inactive `bg-transparent text-txt-secondary border-focus/20 hover:bg-focus/5`, `rounded-full`. Use it for any billable control (timer, lists, items, log entries) instead of a raw checkbox. See `BILLABLE_FEATURE.md`. |
| **Filter pill (active)** | `bg-focus/15 text-focus` |
| **Filter pill (inactive)** | `text-txt-muted hover:text-txt-secondary hover:bg-focus/5` |
| **Container / card** | `bg-transparent border border-focus/30 rounded-xl` |
| **Content card (subtle)** | `bg-focus/5 border border-focus/20 rounded-xl` |
| **Modal surface** | `bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass` |
| **Divider border** | `border-focus/20` |
| **Section border (header/footer)** | `border-b border-focus/20` / `border-t border-focus/20` |
| **Dropdown container** | `bg-drip-elevated border border-focus/30 rounded-xl shadow-glass` |
| **Dropdown item hover** | `hover:bg-focus/5` |
| **Progress bar track** | `bg-focus/10` |
| **Pill / badge** | `bg-focus/5 border border-focus/20 rounded-full` |
| **Hour line dashes** | `border-dashed border-focus/10` |
| **Hover state (generic)** | `hover:bg-focus/5` |
| **Checkbox border** | `border border-focus/20 hover:border-focus/50` |

---

## Semantic Color Palette

| Semantic role | Token | Color |
|---------------|-------|-------|
| Focus sessions / primary accent | `focus` | Amber/orange |
| Break sessions | `break` | Emerald green |
| Calendar events | `blue-500` | Blue |
| Adhoc entries | `focus` (subtle) | Orange-tinted |
| Error / destructive | `red-400` / `red-500` | Red |
| Primary text | `txt-primary` | — |
| Secondary text | `txt-secondary` | — |
| Muted text | `txt-muted` | — |
| Dim text | `txt-dim` | — |

---

## Legacy Patterns to Avoid

These classes still exist in DailyLog, Lists, and Settings views — **do not use them in new code** and migrate when touching those views:

| Legacy class | Replacement |
|-------------|-------------|
| `glass-button` | `px-4 py-2 bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all` |
| `glass-surface-elevated` | `bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass` |
| `bg-glass-bg` | `bg-transparent` (inputs) or `bg-focus/5` (cards) |
| `border-glass-border` | `border-focus/30` (prominent) or `border-focus/20` (subtle) |
| `bg-glass-hover` | `bg-focus/5` |
| `bg-drip-elevated` | Still valid for dropdown backgrounds; replace borders only |

---

## Migration Checklist

When updating an older view to the orange accent design language:

1. Find all `glass-button` usages → replace with ghost button pattern
2. Find all `glass-surface-elevated` → replace with modal surface pattern
3. Find all `bg-glass-bg` → use `bg-transparent` for inputs, `bg-focus/5` for info cards
4. Find all `border-glass-border` → use `border-focus/30` or `border-focus/20`
5. Find all `bg-glass-hover` → use `hover:bg-focus/5`
6. Verify modals: header/footer dividers should be `border-focus/20`
7. Verify dropdowns: container border should be `border-focus/30`, items `hover:bg-focus/5`
8. Verify progress bars: track should be `bg-focus/10`
9. Verify checkboxes: border should be `border-focus/20`
