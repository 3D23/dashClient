export interface InitManifestData {
    bitrates: Array<number>
    totalVideoChunk: number
}

export interface AiDataRequest {
    bitrate: number, //quality number
    bufferLevel: number, //seconds
    videoChunkSize: number, //byte
    delay: number, //ms
    nextVideoChunkSizes: Array<number>, //bytes
    videoChunkRemain: number, //points
}

export interface AiDataResponse {
    bitrate: number
}