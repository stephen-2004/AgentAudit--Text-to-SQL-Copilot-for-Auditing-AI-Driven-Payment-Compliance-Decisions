# -*- coding: utf-8 -*-

from agent_app.source_code import add_two


def test_add_two():
    assert add_two(1, 2) == 3
    assert add_two(-1, 1) == 0
    assert add_two(0, 0) == 0


if __name__ == "__main__":
    from agent_app.tests import run_cov_test

    run_cov_test(
        __file__,
        "agent_app.source_code",
        preview=False,
    )
