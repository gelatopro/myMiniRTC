import { SignalingServer } from './signaling-server';

const PORT = parseInt(process.env.PORT || '8080', 10);

const server = new SignalingServer({ port: PORT });

console.log(`Signaling server running on ws://localhost:${PORT}`);

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await server.close();
  process.exit(0);
});
