import { useRef } from "react"

export default function useRecorder(socket){

  const mediaRecorder = useRef(null)

  const startRecording = async () => {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio:true
    })

    mediaRecorder.current = new MediaRecorder(stream)

    mediaRecorder.current.ondataavailable = (event)=>{

      if(socket){

        socket.send(event.data)

      }

    }

    mediaRecorder.current.start(1000)

  }

  const stopRecording = ()=>{

    if(mediaRecorder.current){

      mediaRecorder.current.stop()

    }

  }

  return {

    startRecording,
    stopRecording

  }

}