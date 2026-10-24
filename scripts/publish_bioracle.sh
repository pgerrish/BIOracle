#!/bin/bash
# Publish BIOracle's local files to its GitHub main branch. Compatible with macOS Bash.
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    printf 'Usage: publish_bioracle [commit message]\n'
    printf 'Sync, commit, and push ~/Documents/GitHub/BIOracle to GitHub.\n'
    exit 0
fi

repo_dir="${BIORACLE_REPO:-$HOME/Documents/GitHub/BIOracle}"
message="${*:-Update BIOracle website}"
saved_stash=''
edits_restored=0

fail() {
    printf 'publish_bioracle: %s\n' "$*" >&2
    exit 1
}

is_bioracle_remote() {
    case "$1" in
        git@github.com:pgerrish/BIOracle|git@github.com:pgerrish/BIOracle.git|\
        https://github.com/pgerrish/BIOracle|https://github.com/pgerrish/BIOracle.git|\
        ssh://git@github.com/pgerrish/BIOracle|ssh://git@github.com/pgerrish/BIOracle.git)
            return 0 ;;
        *) return 1 ;;
    esac
}

[[ -d "$repo_dir" ]] || fail "The local repository is missing: $repo_dir"
cd "$repo_dir"
repo_root="$(pwd -P)"
git_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'This folder is not a Git repository.'
[[ "$git_root" == "$repo_root" ]] || fail 'The BIOracle folder must be the repository root.'
branch="$(git symbolic-ref --quiet --short HEAD)" || fail 'Switch to the main branch before publishing.'
[[ "$branch" == 'main' ]] || fail "The current branch is $branch. Switch to main before publishing."

origin_url="$(git config --get remote.origin.url)" || fail 'The origin remote is missing.'
is_bioracle_remote "$origin_url" || fail 'The origin remote must point to pgerrish/BIOracle on GitHub.'
push_urls="$(git config --get-all remote.origin.pushurl || true)"
if [[ -n "$push_urls" ]]; then
    while IFS= read -r push_url; do
        is_bioracle_remote "$push_url" || fail 'An origin push URL points to a different repository.'
    done <<< "$push_urls"
fi

for state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    [[ ! -e "$(git rev-parse --git-path "$state")" ]] || fail 'Finish or abort the current Git operation before publishing.'
done
[[ -z "$(git ls-files --unmerged)" ]] || fail 'Resolve the existing merge conflicts before publishing.'

finish() {
    exit_status=$?
    if [[ "$exit_status" -ne 0 && -n "$saved_stash" ]]; then
        printf '\npublish_bioracle stopped. Your original edits remain in backup stash %s.\n' "$saved_stash" >&2
        if [[ "$edits_restored" -eq 0 ]]; then
            printf 'After resolving or aborting the Git operation, restore them with:\n' >&2
            printf '  git -C %q stash apply %q\n' "$repo_root" "$saved_stash" >&2
        else
            printf 'Your restored work and any local commits are also retained.\n' >&2
        fi
    fi
    exit "$exit_status"
}
trap finish EXIT

printf 'Synchronizing BIOracle with GitHub...\n'
# Fetch before stashing so a connection failure leaves local edits untouched.
git fetch origin main

if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
    previous_stash="$(git rev-parse --verify --quiet refs/stash || true)"
    git stash push --include-untracked --message "publish_bioracle backup $(date '+%Y-%m-%d %H:%M:%S') ($$)"
    current_stash="$(git rev-parse --verify --quiet refs/stash || true)"
    [[ -n "$current_stash" && "$current_stash" != "$previous_stash" ]] || fail 'Git could not temporarily save the local changes.'
    saved_stash="$current_stash"
fi

git rebase origin/main

if [[ -n "$saved_stash" ]]; then
    git stash apply "$saved_stash" || fail 'The saved edits need conflict resolution. Nothing was pushed.'
    edits_restored=1
fi

git add -A
if ! git diff --cached --quiet; then
    git commit -m "$message"
else
    printf 'No new changes to commit.\n'
fi

# This also publishes commits made before running the command. Never force-push.
git push origin main

if [[ -n "$saved_stash" ]]; then
    # Drop only this command's backup, preserving any pre-existing stashes.
    stash_ref="$(git stash list --format='%gd %H' | awk -v oid="$saved_stash" '$2 == oid && !found { print $1; found = 1 }')"
    if [[ -n "$stash_ref" ]]; then
        git stash drop "$stash_ref" >/dev/null
    fi
    saved_stash=''
fi

printf '\nBIOracle changes are synced to https://github.com/pgerrish/BIOracle\n'
