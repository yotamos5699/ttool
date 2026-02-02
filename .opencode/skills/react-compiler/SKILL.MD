# React Compiler Compatibility — Skill
This skill defines how to write React code that is compatible with the
React Compiler (automatic memoization).

---

## Core Assumptions
React Compiler assumes components are:
- Pure
- Deterministic
- Immutable
- Side-effect free during render

Breaking these assumptions disables optimization.

---

## Required Practices

### Pure Rendering
- Components are pure functions of props, state, and hooks
- No side effects or async work during render
- No reads or writes to external mutable state

### Immutability
- Never mutate props, state, or arguments
- Always create new objects/arrays for updates
- Treat imports as read-only

### Hooks Discipline
- Hooks are never conditional
- Hook order is stable across renders
- Early returns allowed only before hooks

### Side Effects
- All side effects live in `useEffect` / `useLayoutEffect`
- Mutations allowed only in effects or event handlers

### Determinism
- Same inputs → same output
- Avoid `Math.random`, `Date.now`, locale, environment reads
- Use React primitives (`useId`) for stable uniqueness

### Closures
- Capture explicit, stable values
- Avoid hidden mutable closure state
- Prefer passing data via props

### Memoization
- Avoid `useMemo`, `useCallback`, `React.memo` by default
- Use only when referential identity is explicitly required

### TypeScript (Recommended)
- `strict` mode enabled
- Prefer discriminated unions for render branches
- Model data as immutable
---

## Escape Hatches

Allowed when documented:
- `useRef` for mutable instance state
- Unsafe logic isolated in effects
- Compiler opt-out for specific files/components

---
## Compatibility Check
- Pure render logic
- Immutable data flow
- Stable hook order
- No render-time side effects
- Deterministic output
