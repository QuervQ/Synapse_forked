import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface CursorData {
    user: string;
    x: number;
    y: number;
    color: string;
}

interface PresenceState {
    [key: string]: {
        user: string;
        x: number;
        y: number;
        color: string;
        onlineAt: string;
    }[];
}

export function CursorOverlay() {
    const [cursors, setCursors] = useState<{ [key: string]: CursorData }>({});
    const myId = useRef(Math.random().toString(36).substring(7));
    const myColor = useRef('#' + Math.floor(Math.random() * 16777215).toString(16));
    // Use a default name or prompt? For now random.
    const myName = useRef(`User-${myId.current.substring(0, 4)}`);

    useEffect(() => {
        const channel = supabase.channel('cursor-room');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState() as unknown as PresenceState;
                const newCursors: { [key: string]: CursorData } = {};

                Object.entries(state).forEach(([id, presences]) => {
                    if (id !== myId.current && presences.length > 0) {
                        newCursors[id] = presences[0] as CursorData;
                    }
                });
                setCursors(newCursors);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user: myName.current,
                        x: 0,
                        y: 0,
                        color: myColor.current,
                        onlineAt: new Date().toISOString(),
                    });
                }
            });

        // Simple throttle implementation
        let lastSent = 0;
        const throttleLimit = 50; // ms

        const throttledMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastSent > throttleLimit) {
                channel.track({
                    user: myName.current,
                    x: e.clientX,
                    y: e.clientY,
                    color: myColor.current,
                    onlineAt: new Date().toISOString(),
                });
                lastSent = now;
            }
        };

        window.addEventListener('mousemove', throttledMove);

        return () => {
            window.removeEventListener('mousemove', throttledMove);
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '0', pointerEvents: 'none', zIndex: 9999 }}>
            {Object.entries(cursors).map(([id, data]) => (
                <div
                    key={id}
                    style={{
                        position: 'absolute',
                        left: data.x,
                        top: data.y,
                        width: '10px',
                        height: '10px',
                        backgroundColor: data.color,
                        borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        transition: 'left 0.1s linear, top 0.1s linear',
                        pointerEvents: 'none',
                    }}
                >
                    <span style={{ position: 'absolute', top: '12px', left: '0', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 4px', fontSize: '10px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        {data.user}
                    </span>
                </div>
            ))}
        </div>
    );
}
