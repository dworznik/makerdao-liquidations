
export function pairs<T>(arr: T[]): [T, T | undefined][] {
    const result = [] as [T, T | undefined][];
    let i = 0;
    for (; i < arr.length - 1; i += 2) {
        result.push([arr[i], arr[i + 1]]);
    }
    if (i < arr.length) {
        result.push([arr[i], undefined]);
    }
    return result;
}
