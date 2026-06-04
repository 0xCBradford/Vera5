export type CommandPaletteCommand = {
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  isEnabled?: () => boolean;
  run: () => void | Promise<void>;
};

const registeredCommands = new Map<string, CommandPaletteCommand>();

export function registerCommandPaletteCommand(
  command: CommandPaletteCommand
): void {
  registeredCommands.set(command.id, command);
}

export function unregisterCommandPaletteCommand(id: string): boolean {
  return registeredCommands.delete(id);
}

export function clearCommandPaletteCommands(): void {
  registeredCommands.clear();
}

export function listCommandPaletteCommands(): readonly CommandPaletteCommand[] {
  return [...registeredCommands.values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

export function getCommandPaletteCommandById(
  id: string
): CommandPaletteCommand | undefined {
  return registeredCommands.get(id);
}

function commandMatchesQuery(
  command: CommandPaletteCommand,
  normalizedQuery: string
): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = [
    command.id,
    command.label,
    command.description ?? "",
    ...(command.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function filterCommandPaletteCommands(
  query: string
): CommandPaletteCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  return listCommandPaletteCommands().filter((command) => {
    if (command.isEnabled && !command.isEnabled()) {
      return false;
    }
    return commandMatchesQuery(command, normalizedQuery);
  });
}

export async function executeCommandPaletteCommand(id: string): Promise<boolean> {
  const command = registeredCommands.get(id);
  if (!command) {
    return false;
  }
  if (command.isEnabled && !command.isEnabled()) {
    return false;
  }

  await command.run();
  return true;
}
