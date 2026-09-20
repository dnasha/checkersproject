# GitHub Pages releases

Site: [Checkers](https://dnasha.github.io/checkersproject/)

Source branch: `astra-ver`. The original `main` branch is preserved at `50b6935a26c743271ed9ade83edb22e72c79e147`.

## Release 2.0.1

- Release tag: `astra-v2.0.1`
- Renames the product to Checkers and removes decorative copy and redundant labels.
- Simplifies the start screen and lesson titles while retaining rules and instructions.

## Release 2.0.0

- Release tag: `astra-v2.0.0`
- Source commit: `d0f5cba9c1a80ebabe29410c3c2447f751a6c64c`
- [Full CI validation](https://github.com/dnasha/checkersproject/actions/runs/35485801967)
- [Pages release workflow](https://github.com/dnasha/checkersproject/actions/runs/35485911895)

Pages uses **GitHub Actions** as its build source. The `github-pages` environment retains its original `main` branch rule and permits release tags through exact-name rules. Each new release needs its own tag rule. The workflow grants only the repository-read, artifact-read, Pages-write and identity-token permissions it needs.

## Publish an update

1. Commit and push changes on `astra-ver`, then wait for **Check Astra** to pass.
2. In **Settings → Environments → github-pages → Deployment branches and tags**, add a **tag** rule for the new release name, for example `astra-v2.0.2`. Rules for previous release tags do not permit a new tag.
3. Create and push that tag from the tested commit:

   ```sh
   git switch astra-ver
   git tag -a astra-v2.0.2 -m "Release Checkers 2.0.2"
   git push origin astra-v2.0.2
   ```

4. Wait for **Publish Astra to Pages** to finish. It rebuilds and reruns unit and browser tests before deploying.
5. Check the public game and `game.html`. Returning players receive an update offer between games.

Ordinary branch pushes never deploy. The manual **Run workflow** button additionally requires the workflow file to exist on GitHub's default branch. The tag route works while the rewrite remains separate on `astra-ver`.

## Return to the original game

In **Settings → Pages**, select **Deploy from a branch**, choose **main**, and choose **/(root)**. Save and wait for the legacy Pages build. This restores the preserved original source without changing either branch.

An existing installed client may still show its cached version. In that browser, use Developer Tools → Application → Service Workers → **Unregister**, then reload. Unregistering the worker preserves the separate local game database; clearing all site data would remove saved games.

The equivalent authenticated GitHub CLI commands are:

```sh
gh api --method PUT repos/dnasha/checkersproject/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
gh api --method POST repos/dnasha/checkersproject/pages/builds
```

To return to the current Checkers version afterward, select **GitHub Actions** again and rerun the successful Pages release workflow. Do not move an existing release tag to a different commit.
