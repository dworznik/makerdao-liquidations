
export function rangeChunks(start: number, end: number, size: number) {
    if (start === end) {
        return [[start, end]];
    }
    const chunks = [];
    for (let i = start; i < end; i += size) {
        chunks.push([i, Math.min(i + size, end)]);
    }
    return chunks;
}
