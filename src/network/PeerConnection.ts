import { Peer, type DataConnection } from 'peerjs';
import type { NetworkMessage } from './NetworkMessages';

const PEER_PREFIX = 'rebound-duel-';

export class PeerConnection {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public roomCode: string = '';
  public pingMs: number = 0;

  private pingIntervalId: number | null = null;
  private messageListeners: Array<(msg: NetworkMessage) => void> = [];
  private connectListeners: Array<() => void> = [];
  private disconnectListeners: Array<(reason: string) => void> = [];

  constructor() {}

  public static generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(requestedCode?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const code = (requestedCode || PeerConnection.generateRoomCode()).toUpperCase();
      this.roomCode = code;
      this.isHost = true;

      const peerId = `${PEER_PREFIX}${code}`;
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        console.log(`[P2P] Room created with ID: ${id} (Code: ${code})`);
        resolve(code);
      });

      this.peer.on('connection', (conn) => {
        console.log('[P2P] Guest connected to host!');
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[P2P] Peer error:', err);
        if (err.type === 'unavailable-id') {
          // If code is taken, retry with a new code
          this.createRoom().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  public joinRoom(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const cleanCode = code.trim().toUpperCase();
      this.roomCode = cleanCode;
      this.isHost = false;

      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on('open', () => {
        const hostPeerId = `${PEER_PREFIX}${cleanCode}`;
        console.log(`[P2P] Connecting to host: ${hostPeerId}`);
        const conn = this.peer!.connect(hostPeerId, {
          reliable: true,
        });

        conn.on('open', () => {
          console.log('[P2P] Connected to host successfully!');
          this.setupConnection(conn);
          resolve();
        });

        conn.on('error', (err) => {
          console.error('[P2P] Connection error:', err);
          reject(err);
        });

        // Timeout after 12s if cannot connect
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Kết nối tới phòng quá thời gian (Timeout). Vui lòng kiểm tra lại mã phòng.'));
          }
        }, 12000);
      });

      this.peer.on('error', (err) => {
        console.error('[P2P] Peer join error:', err);
        reject(err);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;
    this.isConnected = true;

    conn.on('data', (data) => {
      const msg = data as NetworkMessage;
      if (msg.type === 'PING') {
        this.send({ type: 'PONG', timestamp: msg.timestamp });
        return;
      }
      if (msg.type === 'PONG') {
        const rtt = Date.now() - msg.timestamp;
        this.pingMs = Math.round(rtt / 2);
        return;
      }
      for (const listener of this.messageListeners) {
        try {
          listener(msg);
        } catch (e) {
          console.error('[P2P] Listener error:', e);
        }
      }
    });

    conn.on('close', () => {
      console.warn('[P2P] DataConnection closed');
      this.handleDisconnect('Đối thủ đã ngắt kết nối hoặc thoát phòng.');
    });

    conn.on('error', (err) => {
      console.error('[P2P] DataConnection error:', err);
      this.handleDisconnect(`Lỗi kết nối: ${err.message || 'Mất kết nối'}`);
    });

    this.startPingLoop();

    for (const listener of this.connectListeners) {
      try {
        listener();
      } catch (e) {
        console.error('[P2P] Connect listener error:', e);
      }
    }
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingIntervalId = window.setInterval(() => {
      if (this.isConnected && this.connection && this.connection.open) {
        this.send({ type: 'PING', timestamp: Date.now() });
      }
    }, 2000);
  }

  private stopPingLoop() {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public send(msg: NetworkMessage) {
    if (this.connection && this.connection.open) {
      this.connection.send(msg);
    }
  }

  public onMessage(cb: (msg: NetworkMessage) => void) {
    this.messageListeners.push(cb);
  }

  public onConnect(cb: () => void) {
    this.connectListeners.push(cb);
  }

  public onDisconnect(cb: (reason: string) => void) {
    this.disconnectListeners.push(cb);
  }

  private handleDisconnect(reason: string) {
    this.isConnected = false;
    this.stopPingLoop();
    for (const listener of this.disconnectListeners) {
      try {
        listener(reason);
      } catch (e) {
        console.error('[P2P] Disconnect listener error:', e);
      }
    }
  }

  public disconnect() {
    this.stopPingLoop();
    this.isConnected = false;
    if (this.connection) {
      try {
        this.connection.close();
      } catch (_) {}
      this.connection = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (_) {}
      this.peer = null;
    }
  }
}

export const peerConnection = new PeerConnection();
