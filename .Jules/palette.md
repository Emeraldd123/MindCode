## 2024-11-11 - Accessibility Attributes
**Learning:** In a highly interactive React application, standard interactive elements like buttons that act as toggles for sub-panels or dropdown menus often miss standard ARIA attributes (`aria-expanded`, `aria-pressed`). Also, dynamically rendered loading states are often completely invisible to screen readers without `role="status"` and `aria-live="polite"`.
**Action:** Add these aria attributes proactively whenever creating new interactive or dynamic UI components.
