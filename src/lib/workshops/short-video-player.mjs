export function nextClip(state){return {...state,index:Math.min(state.index+1,Math.max(0,state.total-1)),playing:true}}
export function previousClip(state){return {...state,index:Math.max(0,state.index-1),playing:true}}
export function setPlayback(state,playing){return {...state,playing:Boolean(playing)}}