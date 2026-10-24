#!/bin/bash
# Install preview_bioracle using the same ~/bin convention as publish_bioracle.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source_script="$script_dir/preview_bioracle.sh"
bin_dir="${BIORACLE_BIN_DIR:-$HOME/bin}"
shell_rc="${BIORACLE_SHELL_RC:-${ZDOTDIR:-$HOME}/.zshrc}"
destination="$bin_dir/preview_bioracle"

[[ -f "$source_script" ]] || { printf 'The preview script is missing.\n' >&2; exit 1; }
[[ ! -d "$destination" ]] || { printf '%s is a directory; choose another installation location.\n' "$destination" >&2; exit 1; }
mkdir -p "$bin_dir"
install -m 755 "$source_script" "$destination"

if [[ "$bin_dir" == "$HOME/bin" ]]; then
    path_line='export PATH="$HOME/bin:$PATH"'
else
    printf -v path_line 'export PATH=%q:"$PATH"' "$bin_dir"
fi
mkdir -p "$(dirname "$shell_rc")"
touch "$shell_rc"
if ! grep -Fqx -- "$path_line" "$shell_rc"; then
    printf '\n# BIOracle preview command\n%s\n' "$path_line" >> "$shell_rc"
fi

printf 'Installed %s\n' "$destination"
printf 'Load it in this Terminal window with: source %q\n' "$shell_rc"
printf 'Then run: preview_bioracle\n'
