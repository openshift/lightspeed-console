Update the `branches/` release submodules to the latest commit of their tracked
branches.

The submodules are defined only on `main` (`.gitmodules` maps `branches/pf5` →
`pattern-fly-5` and `branches/4-19` → `release-4.19`).

1. Verify the working tree is clean. If it isn't, stop and report the dirty
   files so the user can decide what to do
2. Check out `main` and make sure it's up to date (`git checkout main`)
3. Create and switch to a branch named `update-submodules`
   (`git checkout -b update-submodules`)
4. Update both submodules to the latest commit of their tracked branches:
   `git submodule update --remote --recursive`
5. Stage the updated submodule pointers (`git add branches/pf5 branches/4-19`)
6. If nothing changed, report that the submodules are already up to date and
   stop. Otherwise commit with:
   `git commit -m "Update release branch submodules to latest"`

Report the result: the new commit that each submodule now points to, or that no
update was needed.
