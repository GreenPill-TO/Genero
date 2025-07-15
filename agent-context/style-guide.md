# Design Description for AI Coding Agent
Design for the TCOIN Wallet homepage
Inspred by https://thinkingmachines.ai/

## 1. Overall Layout
- Layout is single-page scroll, with full-viewport height hero, followed by content blocks stacked vertically.
- Page is responsive, with clear mobile-to-desktop breakpoints and graceful typography scaling.

## 2. Top Navigation (Sticky)
- Horizontally-aligned navigation bar with:
  - Logo on the left.
  - Links to case studies, services, blog, and careers.
- On scroll, the navbar becomes sticky, shrinking slightly and maintaining contrast with background.

```html
<header class="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50">
  <nav class="max-w-screen-xl mx-auto flex justify-between items-center py-4 px-6">
    <div class="logo">Thinking Machines</div>
    <ul class="flex gap-6 text-sm font-medium">
      <li><a href="#case-studies">Case Studies</a></li>
      <li><a href="#services">Services</a></li>
      <li><a href="#blog">Blog</a></li>
      <li><a href="#careers">Careers</a></li>
    </ul>
  </nav>
</header>
```

## 3. Hero Section
Full-height section with:
- Large, bold headline.
- Subheadline with mission/ethos.
- Background is usually muted video or gradient, subtle and ambient.
- Minimalist, confident typography.

```html
<section class="h-screen flex flex-col justify-center items-start px-6 max-w-screen-xl mx-auto">
  <h1 class="text-5xl font-semibold leading-tight">We build data-driven solutions for complex problems.</h1>
  <p class="mt-4 text-lg text-gray-600">We’re a data science consultancy working with governments, NGOs, and enterprises across Southeast Asia.</p>
</section>
```

## 4. Case Studies Preview
- Grid layout showcasing projects.
- Hover reveals context or overlay, subtly animated.
- Typically 2–3 columns on desktop, 1 column on mobile.

```html
<section class="bg-gray-100 py-16">
  <div class="max-w-screen-xl mx-auto px-6">
    <h2 class="text-3xl font-semibold mb-10">Selected Case Studies</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <!-- Card -->
      <div class="group relative overflow-hidden rounded-lg bg-white shadow">
        <img src="/case-thumbnail.jpg" class="w-full h-48 object-cover" />
        <div class="p-6">
          <h3 class="text-lg font-semibold">Optimizing Transit in Manila</h3>
          <p class="text-sm text-gray-600">A city-wide analysis of commuter patterns using smartcard data.</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

## 5. Services / About / Footer
- Sections are spacious, cleanly delineated.
- Footer includes company contact, minimalist social links, and a small logo.

```html
<footer class="bg-black text-white py-12 mt-20">
  <div class="max-w-screen-xl mx-auto px-6 flex flex-col md:flex-row justify-between">
    <div class="mb-6 md:mb-0">© 2025 Thinking Machines</div>
    <div class="flex gap-6 text-sm">
      <a href="#">Privacy</a>
      <a href="#">LinkedIn</a>
      <a href="#">Github</a>
    </div>
  </div>
</footer>
```

## Bonus: Styling Notes (For Tailwind or Custom CSS)
- Font stack: modern sans-serif (likely Inter or similar).
- Color palette: grayscale neutrals + subtle accent (teal or coral).
- Animations: subtle opacity and transform transitions, not flashy.
- Breakpoints: mobile-first with smooth scaling at md and lg.

## Summary
An AI coding agent could replicate the Thinking Machines homepage using:
- A sticky responsive header
- A hero with centered headline and mission
- A grid of case study previews with hover states
- Modular content blocks with clean, semantic markup
- TailwindCSS or CSS Modules with utility-first or BEM classnames
