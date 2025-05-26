import { createContext, useRef, useState } from 'react';
import './App.css';
import PensieveVideoPlayerController from './PensieveVideoPlayerController';
import DynamicVideoPlayerController from './DynamicVideoPlayerController';
import BolaVideoPlayerController from './BolaVideoPlayerController';
import { NGINX_ADDRESS } from './constants';

function App() {
  const videoRef1 = useRef<HTMLVideoElement>(null)
  const videoRef2 = useRef<HTMLVideoElement>(null)
  const videoRef3 = useRef<HTMLVideoElement>(null)
  const ws = useRef<WebSocket | null>(null)
  const [algorithm, setAlgorithm] = useState<string>("")


  return (
    <div className="App">
      <header className="Dash Player">
        <div>
          <h1>Dash Video Player ABR</h1>
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{margin: 20}}>
          <video 
            ref={videoRef1}
            controls
            width={500}
            height={250}>
              <PensieveVideoPlayerController
                videoRef={videoRef1} 
                manifestUrl={'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' }
                ws={ws.current!}
                onChangeAlgorithm={(algorithm) => setAlgorithm(algorithm)}
              />
          </video>
          <h4>{algorithm}</h4>
        </div>
        <div style={{margin: 20}}>
          <video 
            ref={videoRef2}
            controls
            width={500}
            height={250}>
              <DynamicVideoPlayerController 
                videoRef={videoRef2} 
                manifestUrl={'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' } 
                ws={ws.current!}
              />
          </video>
          <h4>DYNAMIC</h4>
        </div>
        </div>
        {/* <div>
          <video 
            ref={videoRef3}
            controls
            width={500}
            height={250}>
              <BolaVideoPlayerController
                videoRef={videoRef3} 
                manifestUrl='https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' 
                ws={ws.current!}
              />
          </video>
          <h4>BOLA</h4>
        </div> */}
      </header>
    </div>
  );
}

export default App;
