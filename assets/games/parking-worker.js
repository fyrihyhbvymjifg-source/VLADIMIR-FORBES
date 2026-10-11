importScripts('parking-engine.js');
onmessage=e=>{try{postMessage({id:e.data.id,path:ParkingEngine.nextExit(e.data.board,60000)})}catch{postMessage({id:e.data.id,path:null})}};
