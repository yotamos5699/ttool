export function catchError<T>(func: () => T): [undefined, T] | [Error] {
  try {
    const data = func();
    return [undefined, data] as [undefined, T];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error))] as [
      Error,
    ];
  }
}

export function catchErrorAsync<T>(
  promise: Promise<T>,
): Promise<[undefined, T] | [Error]> {
  return promise
    .then((data) => [undefined, data] as [undefined, T])
    .catch((error) => [error]);
}
