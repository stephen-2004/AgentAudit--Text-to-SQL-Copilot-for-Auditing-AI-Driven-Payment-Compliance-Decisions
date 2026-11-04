# -*- coding: utf-8 -*-

"""
Every path this package needs, in one place.

Paths are facts about the source tree, not configuration: a swap rewrites the
*contents* of ``data/``, never the filenames.

Only paths that are facts about *this* source tree. Anything whose name belongs
to the dataset is never named here, so swapping a dataset never edits this
package.

Do not add a path speculatively. An entry with no reader silently rots into a
pointer at a directory that no longer exists, which is what happened to every
entry this module has ever lost.
"""

from pathlib import Path
from functools import cached_property


class PathEnum:
    dir_package = Path(__file__).absolute().parent
    dir_project_root = dir_package.parent

    # Coverage report, written by agent_app.tests.helper.
    dir_htmlcov = dir_project_root / "htmlcov"

    # Split by whether the value is a secret. ``.env`` is gitignored and loaded
    # first, so it wins; ``.env.defaults`` is committed. See ``config.py``.
    path_env = dir_project_root / ".env"
    path_env_defaults = dir_project_root / ".env.defaults"

    # Authored content only -- copy, prompt, explainer, seed. Keeping it in one
    # directory is what makes a dataset swap a directory replacement rather than
    # a diff scattered across the repo.
    dir_data = dir_project_root / "data"

    # Read by the frontend, never parsed here. Named so that the preflight
    # check can verify they exist without importing TypeScript.
    path_site_toml = dir_data / "site.toml"
    path_business_context_md = dir_data / "business-context.md"

    # The agent's domain brain.
    path_bi_agent_system_prompt_md = dir_data / "system-prompt.md"

    dir_tmp = dir_project_root / "tmp"

    # Written by the agent's ``write_debug_report`` tool.
    path_debug_report_md = dir_tmp / "debug_report.md"

    @cached_property
    def path_bi_agent_system_prompt_content(self) -> str:
        """Read once per process; the prompt is re-read on every agent build."""
        return self.path_bi_agent_system_prompt_md.read_text(encoding="utf-8")


path_enum = PathEnum()
