const registry = {
  alpha: () => 'alpha',
};

export async function loadRegisteredTarget(moduleName: string) {
  const registered = registry[moduleName as keyof typeof registry];
  return registered ? registered() : import(moduleName);
}
