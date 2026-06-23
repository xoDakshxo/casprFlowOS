import { useWorkspaceStore } from "./stores/workspaceStore";

export function getWorkspaceBaseName(workspacePath: string | null) {
  return workspacePath
    ? workspacePath.split(/[\\/]/).pop()?.replace(/\.casprflowos$/, "") ?? null
    : null;
}

export function updateWindowTitle() {
  const { workspacePath, dirty } = useWorkspaceStore.getState();
  const name = getWorkspaceBaseName(workspacePath) ?? "Untitled";
  const title = `${dirty ? "* " : ""}${name} — casprFlowOS`;
  void window.casprFlowOS?.workspace.setTitle(title);
}
