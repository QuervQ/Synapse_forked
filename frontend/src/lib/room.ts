import { supabase } from './supabase';

export interface Room {
    id: string;
    room_name: string;
    created_by: string;
    created_at: string;
    last_activity: string;
    participant_count: number;
}

export async function createOrGetRoom(roomName: string, userId: string) {
    try {
        const { data: existingRoom } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_name', roomName)
            .single();

        if (existingRoom) {
            await supabase
                .from('rooms')
                .update({ last_activity: new Date().toISOString() })
                .eq('id', existingRoom.id);

            return { data: existingRoom, error: null };
        }

        const { data: newRoom, error: createError } = await supabase
            .from('rooms')
            .insert([
                {
                    room_name: roomName,
                    created_by: userId,
                }
            ])
            .select()
            .single();

        if (createError) {
            return { data: null, error: createError };
        }

        return { data: newRoom, error: null };
    } catch (error) {
        console.error('Error in createOrGetRoom:', error);
        return { data: null, error };
    }
}

export async function joinRoom(roomId: string, userId: string, userName: string) {
    try {
        const { data: existing } = await supabase
            .from('room_participants')
            .select('*')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            return { data: existing, error: null };
        }

        const { data, error } = await supabase
            .from('room_participants')
            .insert([
                {
                    room_id: roomId,
                    user_id: userId,
                    user_name: userName,
                }
            ])
            .select()
            .single();

        if (error) {
            return { data: null, error };
        }

        await updateParticipantCount(roomId);

        return { data, error: null };
    } catch (error) {
        console.error('Error in joinRoom:', error);
        return { data: null, error };
    }
}

export async function leaveRoom(roomId: string, userId: string) {
    try {
        const { error } = await supabase
            .from('room_participants')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', userId);

        if (error) {
            return { error };
        }

        await updateParticipantCount(roomId);

        return { error: null };
    } catch (error) {
        console.error('Error in leaveRoom:', error);
        return { error };
    }
}

async function updateParticipantCount(roomId: string) {
    const { count } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

    await supabase
        .from('rooms')
        .update({
            participant_count: count || 0,
            last_activity: new Date().toISOString()
        })
        .eq('id', roomId);
}

export async function getActiveRooms(limit = 20) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('last_activity', { ascending: false })
            .limit(limit);

        if (error) {
            return { data: null, error };
        }

        return { data, error: null };
    } catch (error) {
        console.error('Error in getActiveRooms:', error);
        return { data: null, error };
    }
}

export async function getRoomParticipants(roomId: string) {
    try {
        const { data, error } = await supabase
            .from('room_participants')
            .select('*')
            .eq('room_id', roomId)
            .order('joined_at', { ascending: true });

        if (error) {
            return { data: null, error };
        }

        return { data, error: null };
    } catch (error) {
        console.error('Error in getRoomParticipants:', error);
        return { data: null, error };
    }
}
