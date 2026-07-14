---
title: "Home"
nav_order: 1
---

# LUMI AIF Learning Template

This is the official template for creating clean, branded self-learning course sites. By using this template, you ensure that your training materials match the **LUMI AI Factory** visual identity automatically.

For a quick overview of the Markdown syntax, see the [Markdown Cheat Sheet](https://www.markdownguide.org/cheat-sheet/).

## Add more pages
1. **Create a new page:** `index.md` is the 'landing page' of the website, do not rename it. You can add more pages by dropping new `.md` files into `content/` (or a subfolder). To remove the example chapter, delete `content/chapter1.md`.
2. **Add front matter.** Every page needs these lines at the top:

```markdown
---
title: "Home"
nav_order: 1
---
```

Where:
- `title` is the name shown in the sidebar and the browser tab.
- `nav_order` controls the order pages appear in the sidebar.
- `parent` (optional) groups a page underneath a chapter — see
  `content/chapter1.md` for an example.

## Branded callout boxes

Use callout boxes to highlight information for your students. Just start a blockquote with `[!type]` and optionally a custom title. The next line or lines are the main content of the callout box.

> [!note] LUMI Purple — Note
> Use this for additional context or general helpful information.

> [!warning] LUMI Magenta — Warning
> Use this for critical warnings, security notices, or common errors to avoid.

> [!info] Light Blue — Info
> Use this for neutral side-notes, references, or background information.

> [!tip] Deep Blue — Tip
> Use this for pro-tips, shortcuts, or recommended best practices.


The `command` callout renders a copyable terminal command:

> [!command]
> srun --pty bash

Make sure to leave an empty line before and after each callout.

## Technical content

- **Links** turn magenta on hover.
- **Inline commands**: use backticks to show code like `srun --pty bash`.
- **Code blocks**: triple backticks render syntax-highlighted blocks with a
  copy button in the top-right corner. Always leave an empty line before and
  after the block:

```python
import math

result = math.sqrt(25)
print(f"The calculation result is: {result}")
```

You can optionally label a code block with a filename — handy when the
snippet belongs to a specific script. Just add `title="..."` after the
language:

```python title="train.py"
import torch
model = torch.nn.Linear(10, 1)
```

- **Terminal blocks**: tag a code block with `bash`, `shell`, `zsh`, or `console` and it renders as an Ubuntu styled terminal window with a `user@lumi:~$` prompt on every line. The copy button only copies the actual commands — not the prompt — so students can paste straight into their shell:

```bash
module purge
module use /appl/local/laifs/modules
module load lumi-aif-singularity-bindings
```

- **Shell scripts**: tag a code block with `sh` and it renders as a nano editor window instead — a file being edited, with no `user@lumi:~$` prompt. Use this for `.sh` scripts students save and run, rather than commands typed live:

```sh title="submit.sh"
#!/bin/bash
#SBATCH --partition=standard-g
#SBATCH --nodes=1

srun python train.py
```

## Quizzes

Tag a code block with `quiz` to turn it into an interactive multiple-choice box in LUMI colours. Readers pick an answer, instantly see whether they were right (and which option was correct), read an optional explanation, then click **Next question** to move on. A running score appears once every question is answered.

One `quiz` block can hold several questions, separated by a line of `---`. Mark answers with Markdown checkboxes — `[x]` for correct, `[ ]` for wrong. Start each question with `Q:`, add an optional `title:` line at the top, and an optional explanation line starting with `>`:

````text
```quiz
title: Check your understanding

Q: Which workload manager does LUMI use?
- [ ] PBS
- [x] Slurm
- [ ] LSF
> LUMI runs all batch jobs through the Slurm workload manager.

---

Q: Which of these are valid GPU partitions? (select all)
- [x] standard-g
- [x] small-g
- [ ] turbo-x
> standard-g and small-g exist; turbo-x is made up.
```
````

- A question with a single `[x]` reveals feedback as soon as the reader clicks an option.
- A question with **two or more** `[x]` answers becomes a "select all that apply" question: the reader ticks several boxes, then clicks **Check answer**.

And here is exactly that example, live — try answering it:

```quiz
title: Check your understanding

Q: Which workload manager does LUMI use?
- [ ] PBS
- [x] Slurm
- [ ] LSF
> LUMI runs all batch jobs through the Slurm workload manager.

---

Q: Which of these are valid GPU partitions? (select all)
- [x] standard-g
- [x] small-g
- [ ] turbo-x
> standard-g and small-g exist; turbo-x is made up.
```

See [Chapter 1](/chapter1) for another example in context.


## Embedding pictures


Drop your image in the `public/assets/` folder of the repository, then reference it from any `.md` file using the `./assets/...` form as such:

![LUMI data center facade from the LUMI brand guide](./assets/lumi-data-center.jpg)

Images are clickable and can be opened full-screen. 

(Optional) For a captioned, resized image, use HTML directly inside your markdown. Use a percentage width (`%`) so the image scales with the text column and looks the same on every screen:

<figure>
  <img src="./assets/lumi-data-center.jpg" alt="LUMI data center visual from the LUMI brand guide" style="width: 60%; max-width: 100%; margin: 0 auto; display: block;" />
  <figcaption><em>Figure 1: LUMI data center visual from the LUMI brand guide.</em></figcaption>
</figure>

## Embedding YouTube videos

To add a video, simply copy the **Embed code** from YouTube (Share > Embed) and paste it into the `.md` file:

<iframe width="560" height="315" src="https://www.youtube.com/embed/aLae9Sd2oos?si=uJ_6ccR3ArrpVXqT" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Tables

Tables can be added with this syntax:

| Nodes | CPUs             | CPU cores  | Memory   |
|:------|:-----------------|:-----------|:---------|
| 1888  | 2x AMD EPYC 7763 | 128 (2x64) | 256 GiB  |
| 128   | 2x AMD EPYC 7763 | 128 (2x64) | 512 GiB  |
| 32    | 2x AMD EPYC 7763 | 128 (2x64) | 1024 GiB |

(The vertical lines don't necessarily need to align perfectly in terms of spaces between them. AI can help you in converting your material to a table like this)

Always leave an empty line before and after the table.

## Mathematical formulas

Write LaTeX formulas using KaTeX. Use single dollar signs for inline math and double dollar signs for block math.

- **Inline math:** $E = mc^2$
- **Block math:**

$$
\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}
$$

$$
\int_{-\infty}^{\infty} e^{-x^2}\, dx = \sqrt{\pi}
$$

## Section links and table of contents

Every heading on the page automatically gets a copy-link icon next to it on hover — clicking it copies a deep link to that section to your clipboard.
The table of contents on the right tracks your scroll position and updates the URL link live, so the link you share always points to whatever the reader is currently looking at.

## Glossary & hover definitions

The [Glossary](/glossary) page is a normal `.md` file that lives right next to `index.md` and the chapter files in the `content/` folder. It **must be named exactly `glossary.md`** (all lowercase) and needs the same front matter as any other page. The first `| Term | Definition |` table in that file is automatically parsed into the glossary.

Once a term is defined there, you can reference it anywhere by putting a single percent sign directly after the word. The reader sees a dashed underline and gets the definition in a pop-up on hover — try it here: you write everything in Markdown%, every page starts with Front Matter%, and you highlight things with a Callout%.

- Type the term and add a percent sign right after it, with no space: Markdown%.
- Matching is case-insensitive, so markdown% also works.
- Multi-word terms work too — put the percent sign after the last word: Front Matter%.
- Plural forms are also recognised — if the glossary defines **Front Matter**, then Front Matters% works just as well. Even back-ticked code terms work: `Front Matters%` is recognised too.
- The percent sign can go inside *or* outside any inline formatting, so `Front Matter%` and `Front Matter`% both work, as do *Front Matter%* and *Front Matter*%.
- A word that isn't in the glossary table is left exactly as you typed it, so ordinary percent signs are never affected.

See the [Glossary](/glossary) page for the term table you edit.

## Need help?

If you have ideas on how to make this template even better, I’d love to hear them! Send me an email at `name.surname@csc.fi` where name is Artur and surname is Vojt-Antal (anti-spam measure).
