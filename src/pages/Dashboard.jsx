import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Plus, CheckCircle, Circle, Clock, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
    const [date, setDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('09:00');
    const [newTaskType, setNewTaskType] = useState('work'); // 'work' | 'visit' | 'other'
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Check Session & Role
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) checkUserRole(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) checkUserRole(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session) {
            fetchTasks(date);
        }
    }, [date, session]);

    const checkUserRole = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (data && data.role === 'admin') {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    };

    const fetchTasks = async (selectedDate) => {
        setLoading(true);
        const start = startOfDay(selectedDate).toISOString();
        const end = endOfDay(selectedDate).toISOString();

        const { data, error } = await supabase
            .from('schedule_items')
            .select('*')
            .gte('start_time', start)
            .lte('start_time', end)
            .order('start_time', { ascending: true });

        if (error) console.error('Error fetching tasks:', error);
        else setTasks(data || []);
        setLoading(false);
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!isAdmin) return alert("관리자만 일정을 추가할 수 있습니다.");

        setIsSubmitting(true);
        // Combine date and time
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateTime = new Date(`${dateStr}T${newTaskTime}:00`);

        const { error } = await supabase
            .from('schedule_items')
            .insert([
                {
                    title: newTaskTitle,
                    start_time: dateTime.toISOString(),
                    end_time: dateTime.toISOString(), // Simplified for now
                    status: 'pending',
                    user_id: session.user.id,
                    description: newTaskType // Using description field for 'type' temporarily or add a type column
                }
            ]);

        if (error) {
            alert('일정 추가 실패: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewTaskTitle('');
            fetchTasks(date); // Refresh
        }
        setIsSubmitting(false);
    };

    const toggleTaskStatus = async (taskId, currentStatus) => {
        if (!isAdmin) return; // Optional: Only admins modify? Or users can complete? Let's assume admins for now based on strict rule.

        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        const { error } = await supabase
            .from('schedule_items')
            .update({ status: newStatus })
            .eq('id', taskId);

        if (!error) fetchTasks(date);
    };

    const deleteTask = async (taskId) => {
        if (!isAdmin) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const { error } = await supabase
            .from('schedule_items')
            .delete()
            .eq('id', taskId);

        if (!error) fetchTasks(date);
    };

    const tileContent = ({ date, view }) => {
        // Optimization: In a real app, we should fetch monthly counts to show dots efficiently
        // For now, this is static or requires fetching all month data which is heavy.
        // Leaving simple for MVP.
        return null;
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 relative">
            {/* Left Column: Calendar */}
            <div className="w-full lg:w-1/3">
                <div className="glass-card p-6">
                    <h2 className="text-xl font-heading font-bold mb-4 text-kepco-navy">Calendar</h2>
                    <div className="calendar-wrapper">
                        <Calendar
                            onChange={setDate}
                            value={date}
                            tileContent={tileContent}
                            className="w-full border-none font-sans"
                        />
                    </div>
                </div>

                {/* User Info / Role Badge */}
                <div className="mt-4 p-4 glass-card flex items-center justify-between">
                    <div>
                        <p className="text-xs text-kepco-gray uppercase font-bold">Logged in as</p>
                        <p className="text-sm font-semibold truncate max-w-[150px]">{session?.user?.email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isAdmin ? 'bg-kepco-navy text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {isAdmin ? 'Admin' : 'Viewer'}
                    </span>
                </div>
            </div>

            {/* Right Column: Task List */}
            <div className="w-full lg:w-2/3">
                <div className="glass-card p-6 min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-kepco-navy">
                                {format(date, 'MMMM d, yyyy')}
                            </h2>
                            <p className="text-kepco-gray text-sm">Today's Schedule</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={18} />
                                <span>Add Task</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-40 text-kepco-blue">
                                <Loader2 className="animate-spin h-8 w-8" />
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                    <Clock className="h-8 w-8 text-gray-300" />
                                </div>
                                <p>No schedules for this day.</p>
                                {isAdmin && <p className="text-sm mt-2 text-kepco-blue cursor-pointer hover:underline" onClick={() => setIsModalOpen(true)}>Create one now</p>}
                            </div>
                        ) : (
                            tasks.map(task => (
                                <div key={task.id} className="group bg-white border border-gray-100 p-4 rounded-xl flex items-center justify-between hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => toggleTaskStatus(task.id, task.status)}
                                            className={`transition-colors ${isAdmin ? 'cursor-pointer hover:text-kepco-blue' : 'cursor-default'}`}
                                            disabled={!isAdmin}
                                        >
                                            {task.status === 'completed' ? <CheckCircle className="text-green-500" /> : <Circle className="text-gray-300" />}
                                        </button>
                                        <div>
                                            <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-kepco-navy'}`}>
                                                {task.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <Clock size={12} />
                                                <span>{format(parseISO(task.start_time), 'HH:mm')}</span>
                                                {task.description && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-50 text-kepco-blue`}>
                                                        {task.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                                            title="Delete Task"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-heading font-bold text-kepco-navy">Add New Schedule</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    className="input-field"
                                    placeholder="e.g. 본부장 주간 회의"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={newTaskTime}
                                        onChange={(e) => setNewTaskTime(e.target.value)}
                                        className="input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={newTaskType}
                                        onChange={(e) => setNewTaskType(e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="work">업무 (Work)</option>
                                        <option value="visit">순시 (Visit)</option>
                                        <option value="meeting">회의 (Meeting)</option>
                                        <option value="event">행사 (Event)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full btn-primary flex justify-center items-center py-3 text-lg"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Create Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
