import { MediaPlayer, MediaPlayerClass, MediaPlayerEvent, MediaPlayerEvents } from "dashjs"
import { useEffect, useRef, useState } from "react"
import { SERVER_ADDRESS } from "./constants"

export interface VideoPlayerControllerProps  {
    videoRef : React.RefObject<HTMLVideoElement | null>, 
    manifestUrl: string,
    ws: WebSocket,
    onChangeAlgorithm: (algorithm: string) => void
}

type SegmentSizesDicrionary = {
    [key: number]: Array<number>
} 

export default function PensieveVideoPlayerController({videoRef, manifestUrl, ws, onChangeAlgorithm} : VideoPlayerControllerProps) {
    const BUFFER_THRESHOLD = 40
    const playerRef = useRef<MediaPlayerClass | null>(null)
    const bufferLevel = useRef<number>(0)
    const bitrates = useRef<Array<number>>([]) // kbps
    const currentBitrate = useRef<number>(0) 
    const segmentDuration = useRef<number>(0)
    const videoDuration = useRef<number>(0)
    const downloadTimeLastChunk = useRef<number>(0) // milliseconds
    const downloadTimeStartNextChunk = useRef<number>(0)
    const segmentsDownloadCounter = useRef<number>(0)
    const totalSegments = useRef<number>(0)
    const segmentsRemain = useRef<number>(0)
    const segmentSize = useRef<number>(0)
    const representations = useRef<Array<any>>([])
    const segmentSizes = useRef<SegmentSizesDicrionary>({})
    const maxSegmentSizes = useRef<Array<number>>([])
    const nextSegmentSizes = useRef<Array<number>>([])
    const manifestInited = useRef<boolean>(false)
    const rebufferingTime = useRef<number>(0)
    const startRebufferingTime = useRef<number>(0)
    const lastBitrate = useRef<number>(0)
    const bitratesIndex = [0, 1, 3, 5, 7, 9]
    const throughput = useRef<number>(0)
    const isAi = useRef<boolean>(false)
    const isInitPensieve = useRef<boolean>(false)
    
    const bitratesChangesHistory = useRef<Array<number>>([])
    const rebufferingsTimesHistory = useRef<Array<number>>([])
    const bitratesHistory = useRef<Array<number>>([])

    const addItem = (history: Array<any>, item: any, capacity: number) => {
        if (history.length < capacity) {
            history.push(item)
        }
        else {
            history.push(item)
            history.shift()
        }
    }

    useEffect(() => {
        onChangeAlgorithm(isAi.current ? "AI" : "DYNAMIC")
        const interval = setInterval(() => {
            var bitartes = bitrates.current.filter((_, index) => bitratesIndex.includes(index))
            addItem(bitratesHistory.current, Math.log(bitartes[currentBitrate.current] / bitartes[0]), 10)
            addItem(rebufferingsTimesHistory.current, rebufferingTime.current, 10)
            addItem(bitratesChangesHistory.current, currentBitrate.current - lastBitrate.current, 10)
            console.log(bitratesHistory)
            lastBitrate.current = currentBitrate.current
            const qoeValue = bitratesHistory.current.reduce((acc, cur) => acc + cur, 0)
                - 0.5 * rebufferingsTimesHistory.current.reduce((acc, cur) => acc + cur, 0)
                - bitratesChangesHistory.current.reduce((acc, cur) => acc + cur, 0)
    
            if (playerRef.current !== null) {
                fetch(SERVER_ADDRESS + '/update_metrics', {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        algorithm: 'pensieve + dynamic',
                        qoe: qoeValue,
                        throughput: throughput.current,
                        buffer_level: playerRef.current.getBufferLength('video') ?? 0,
                        bitrate: bitartes[currentBitrate.current],
                        rebuffering_time: rebufferingTime.current / 1000
                    })
                }).then((d) => {
                    console.log(d)
                })
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        async function getNextSegmentSizes() {

            for (let i = 0; i < totalSegments.current; i++) {
                const sizes = []
                for (let j = 0; j < bitrates.current.length; j++) {
                    const url = 'https://dash.akamaized.net/akamai/bbb_30fps/' + representations.current[j]['id'] + '/' + representations.current[j]['id'] + '_' + i + '.m4v'
                    const response = await fetch(url, { method: 'HEAD' })
                    if (response.headers.get('content-length') !== null) {
                        sizes.push(parseInt(response.headers.get('content-length')!))
                    }
                }
                segmentSizes.current[i] = sizes.sort((b1: number, b2: number) => b1 >= b2 ? 1 : -1)
            }
        }

        if (videoRef.current && !playerRef.current) {
            const player = MediaPlayer().create()
            player.initialize(videoRef!.current, manifestUrl, true)
            playerRef.current = player
            player.updateSettings({
                streaming: {
                    buffer: {
                        fastSwitchEnabled: true
                    }
                }
            })
            player.on('fragmentLoadingCompleted', (e) => {
                console.log(segmentSizes.current)
                if (e.request.index === segmentsDownloadCounter.current) return;
                const mediaType = (e as any).mediaType
                if (mediaType !== 'video')
                    return
                console.log(e)
                if (Number.isNaN(e.request.index))
                    return
                segmentsDownloadCounter.current = e.request.index
                segmentsRemain.current = totalSegments.current - segmentsDownloadCounter.current
                segmentSize.current = e.request.bytesTotal
                if (segmentSizes.current[segmentsDownloadCounter.current + 1] === undefined) {
                    nextSegmentSizes.current = maxSegmentSizes.current
                }
                else {
                    nextSegmentSizes.current = segmentSizes.current[segmentsDownloadCounter.current + 1]
                }
                console.log(nextSegmentSizes.current)
                if (downloadTimeStartNextChunk.current === null)
                    return
                downloadTimeLastChunk.current = new Date().getTime() - downloadTimeStartNextChunk.current //milliseconds
                throughput.current = (e.request.bytesLoaded * 8) / (downloadTimeLastChunk.current / 1000)
                bufferLevel.current = player.getBufferLength('video')
                console.log('segments downloads ' + segmentsDownloadCounter.current)
                console.log('segmentsRemain ' + segmentsRemain.current)
                if (manifestInited.current === false)
                    return
                if (isAi.current || isInitPensieve.current === false) {
                    if (!isNaN(bufferLevel.current)) {
                    if (currentBitrate.current === undefined)
                        currentBitrate.current = 0
                    fetch(SERVER_ADDRESS + '/predict', {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify( {
                            bitrate: currentBitrate.current,
                            buffer_level: bufferLevel.current,
                            video_chunk_size: segmentSize.current,
                            delay: downloadTimeLastChunk.current,
                            next_video_chunk_sizes: nextSegmentSizes.current.filter((_, index) => bitratesIndex.includes(index)),
                            video_chunk_remain: segmentsRemain.current
                        })
                    }).then((d) => {
                        d.json().then((data) => {
                            console.log(data)
                            currentBitrate.current = data.predicted
                        })
                        isInitPensieve.current = true
                    })
                }
                }
            })
            
            player.on('bufferLevelUpdated', (e) => {
                console.log(bufferLevel.current)
                if (playerRef.current) {
                    if (playerRef.current.getBufferLength('video') <= BUFFER_THRESHOLD && isInitPensieve.current == true) {
                    if (isAi.current == false) 
                        onChangeAlgorithm("AI")
                    isAi.current = true
                }
                    else {
                        if (isAi.current == true) 
                            onChangeAlgorithm("DYNAMIC")
                        isAi.current = false
                    }
                }
            })

            player.on('fragmentLoadingStarted', (e) => {
                const mediaType = (e as any).mediaType
                if (mediaType !== 'video')
                    return
                if (isAi.current) {
                    playerRef.current?.setRepresentationForTypeByIndex('video', bitratesIndex[currentBitrate.current])
                }
                else {
                    playerRef.current?.updateSettings({
                            streaming: {
                                abr: {
                                    autoSwitchBitrate: {
                                        video: true
                                    },
                                    rules: {
                                        bolaRule: {
                                            active: true
                                        },
                                        throughputRule: {
                                            active: true
                                        }
                                    }
                                }
                            }
                        }
                    )
                }
                downloadTimeStartNextChunk.current = new Date().getTime()
                console.log('segmentLoadingStarted')
            })

            player.on('bufferEmpty', (e) => {
                startRebufferingTime.current = new Date().getTime()
            })

            player.on('bufferLoaded', (e) => {
                if (startRebufferingTime.current !== 0) 
                    rebufferingTime.current = new Date().getTime() - startRebufferingTime.current
            })

            player.on('manifestLoaded', (e) => {
                const data = (e.data as any)
                videoDuration.current = data['mediaPresentationDuration']
                const videoAdaptationSet = data['Period'][0]['AdaptationSet'].filter((item: { [x: string]: string }) => item['contentType'] === 'video')
                segmentDuration.current = videoAdaptationSet[0]['SegmentTemplate'].duration / videoAdaptationSet[0]['SegmentTemplate'].timescale
                totalSegments.current = Math.ceil(videoDuration.current / segmentDuration.current)
                bitrates.current = videoAdaptationSet[0]['Representation']
                                    .map((item: { bandwidth: number }) => item.bandwidth / 1000)
                                    .sort((b1: number, b2: number) => b1 >= b2 ? 1 : -1)
                representations.current = videoAdaptationSet[0]['Representation']
                getNextSegmentSizes()
                maxSegmentSizes.current = representations.current
                                    .map((r) => segmentDuration.current * r.bandwidth / 8)
                                    .sort((b1: number, b2: number) => b1 >= b2 ? 1 : -1)
                fetch(SERVER_ADDRESS + '/init_manifest', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        bitrates: bitrates.current.filter((_, index) => bitratesIndex.includes(index)),
                        total_video_chunk: totalSegments.current
                    })
                }).then((e) => {
                    console.log(e.status)
                    if (e.status === 200) {
                        manifestInited.current = true
                    }
                })
            })
        } 
    }, [manifestUrl, videoRef])
    
    return (<></>)
}