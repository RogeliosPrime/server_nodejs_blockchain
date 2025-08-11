const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const activeNodes = new Map();

io.on('connection', (socket) => {
  nodeId = socket.handshake.auth.node_id || generateRandomId();
  console.log(`📡 Nodo conectado: ${nodeId}`);
  activeNodes.set(nodeId, {node_socket: socket,node_status:socket.handshake.auth.status});

  // Enviar lista de nodos activos al nuevo nodo
  //socket.emit('nodes', Array.from(activeNodes.keys()));

  // Notificar a todos los demás nodos que hay un nuevo nodo
  for (const [id, otherSocket] of activeNodes.entries()) {
    if (id !== nodeId) {
      otherSocket.emit('nodes', Array.from(activeNodes.keys()));
    }
  }

  socket.on('get_nodes',(data)=>{
    const target = activeNodes.get(data.target);
    if (target) {
      const nodes = Array.from(activeNodes.keys());
      
      target.node_socket.emit('nodes', nodes.filter((x) => x.node_status == target.node_status));
    }
  });

  // 🔁 Reenviar offer
  socket.on('offer', (data) => {
    const target = activeNodes.get(data.target).node_socket;
    if (target) {
      target.emit('offer', {
        sender: nodeId,
        sdp: data.sdp,
        type: data.type,
        status: data.status
      });
    }
  });

  // 🔁 Reenviar answer
  socket.on('answer', (data) => {
    const target = activeNodes.get(data.target).node_socket;
    if (target) {
      target.emit('answer', {
        sender: nodeId,
        sdp: data.sdp,
        type: data.type,
      });
    }
  });

  socket.on('updateStatus', (data) => {
    const node = activeNodes.get(data.target);
    if (node) {
      node.node_status = data.status;
    } else {
      console.warn(`Nodo no encontrado: ${data.target}`);
    }
  });

  // 🔁 Reenviar ICE candidates
  socket.on('ice_candidate', (data) => {
    const target = activeNodes.get(data.target).node_socket;
    if (target) {
      target.emit('ice_candidate', {
        sender: nodeId,
        candidate: data.candidate,
      });
    }
  });

  // Limpiar al desconectar
  socket.on('disconnect', () => {
    console.log(`❌ Nodo desconectado: ${nodeId}`);
    activeNodes.delete(nodeId);
    for (const sock of activeNodes.values()) {
      sock.emit('nodes', Array.from(activeNodes.keys()));
    }
  });
});

function generateRandomId() {
  return Math.random().toString(36).substring(2, 11);
}

server.listen(3000, () => {
  console.log('🚀 Servidor WebRTC listo en puerto 3000');
});
