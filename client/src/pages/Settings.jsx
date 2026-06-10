import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Building2, Users, Eye, EyeOff, Plus, Pencil,
    ToggleLeft, ToggleRight, X, Save, KeyRound, ShieldCheck,
    ClipboardList, Copy, Check, RefreshCw, Link2, Tablet, Download, Camera, Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import { useToast } from '../components/Toast';

const ALL_TABS = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'clinic', label: 'Clinic Info', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users, adminOnly: true },
    { key: 'forms', label: 'Forms', icon: ClipboardList },
];

const ROLES = ['admin', 'dentist', 'hygienist', 'receptionist'];

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }) {
    return <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">{children}</label>;
}

function FieldGroup({ label, children }) {
    return (
        <div>
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function SectionTitle({ children }) {
    return <h3 className="font-semibold text-text-primary mb-4">{children}</h3>;
}

function SaveButton({ loading, label = 'Save Changes' }) {
    return (
        <button type="submit" disabled={loading} className="btn-primary">
            <Save className="w-4 h-4" />
            {loading ? 'Saving…' : label}
        </button>
    );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab() {
    const { admin, fetchMe } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef(null);

    const [profile, setProfile] = useState({ full_name: '', email: '', username: '' });
    const [profileLoading, setProfileLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(null); // local preview before upload
    const [photoLoading, setPhotoLoading] = useState(false);

    const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });

    useEffect(() => {
        if (admin) {
            setProfile({ full_name: admin.full_name || '', email: admin.email || '', username: admin.username || '' });
        }
    }, [admin]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            await client.put('/settings/profile', profile);
            await fetchMe();
            showToast('Profile updated successfully', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update profile', 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    // ── Photo handlers ──
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image must be under 2 MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target.result);
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handlePhotoUpload = async () => {
        if (!photoPreview) return;
        setPhotoLoading(true);
        try {
            await client.post('/settings/profile/photo', { photo_data: photoPreview });
            await fetchMe();
            setPhotoPreview(null);
            showToast('Profile photo updated!', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to upload photo', 'error');
        } finally {
            setPhotoLoading(false);
        }
    };

    const handlePhotoRemove = async () => {
        if (!window.confirm('Remove your profile photo?')) return;
        setPhotoLoading(true);
        try {
            await client.delete('/settings/profile/photo');
            await fetchMe();
            setPhotoPreview(null);
            showToast('Profile photo removed', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to remove photo', 'error');
        } finally {
            setPhotoLoading(false);
        }
    };


    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (pwd.newPassword !== pwd.confirm) {
            showToast('New passwords do not match', 'error');
            return;
        }
        setPwdLoading(true);
        try {
            await client.put('/auth/change-password', {
                currentPassword: pwd.currentPassword,
                newPassword: pwd.newPassword,
            });
            setPwd({ currentPassword: '', newPassword: '', confirm: '' });
            showToast('Password changed successfully', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to change password', 'error');
        } finally {
            setPwdLoading(false);
        }
    };

    const toggleShow = (field) => setShowPwd(s => ({ ...s, [field]: !s[field] }));

    return (
        <div className="space-y-6">

            {/* ── Profile Photo ── */}
            <div className="card">
                <h3 className="font-semibold text-text-primary mb-4">Profile Photo</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

                    {/* Avatar preview */}
                    <div className="relative shrink-0">
                        <div
                            className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-200 cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                            title="Click to change photo"
                        >
                            {(photoPreview || admin?.profile_photo) ? (
                                <img
                                    src={photoPreview || admin.profile_photo}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                                    {admin?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'A'}
                                </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Info + actions */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                            {admin?.full_name || 'Admin'}
                        </p>
                        <p className="text-xs text-slate-400 capitalize mb-3">{admin?.role}</p>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                            >
                                <Camera className="w-3.5 h-3.5" />
                                {admin?.profile_photo ? 'Change Photo' : 'Upload Photo'}
                            </button>

                            {photoPreview && (
                                <button
                                    type="button"
                                    onClick={handlePhotoUpload}
                                    disabled={photoLoading}
                                    className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {photoLoading ? 'Saving…' : 'Save Photo'}
                                </button>
                            )}

                            {photoPreview && (
                                <button
                                    type="button"
                                    onClick={() => setPhotoPreview(null)}
                                    className="btn-ghost text-xs py-1.5 px-3"
                                >
                                    Cancel
                                </button>
                            )}

                            {admin?.profile_photo && !photoPreview && (
                                <button
                                    type="button"
                                    onClick={handlePhotoRemove}
                                    disabled={photoLoading}
                                    className="btn-ghost text-xs py-1.5 px-3 gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove
                                </button>
                            )}
                        </div>

                        <p className="text-xs text-slate-400 mt-2">
                            JPG, PNG or WebP · Max 2 MB · Click on the photo to browse
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Profile Information ── */}
            <div className="card">
                <SectionTitle>Profile Information</SectionTitle>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FieldGroup label="Full Name">
                            <input
                                className="form-input"
                                value={profile.full_name}
                                onChange={e => setProfile(s => ({ ...s, full_name: e.target.value }))}
                                required
                            />
                        </FieldGroup>
                        <FieldGroup label="Username">
                            <input
                                className="form-input"
                                value={profile.username}
                                onChange={e => setProfile(s => ({ ...s, username: e.target.value }))}
                                required
                                minLength={3}
                            />
                        </FieldGroup>
                    </div>
                    <FieldGroup label="Email">
                        <input
                            type="email"
                            className="form-input"
                            value={profile.email}
                            onChange={e => setProfile(s => ({ ...s, email: e.target.value }))}
                            required
                        />
                    </FieldGroup>
                    <div className="pt-1">
                        <SaveButton loading={profileLoading} />
                    </div>
                </form>
            </div>

            {/* Password */}
            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <KeyRound className="w-4 h-4 text-text-secondary" />
                    <SectionTitle>Change Password</SectionTitle>
                </div>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    {[
                        { key: 'current', label: 'Current Password', field: 'currentPassword' },
                        { key: 'new', label: 'New Password', field: 'newPassword' },
                        { key: 'confirm', label: 'Confirm New Password', field: 'confirm' },
                    ].map(({ key, label, field }) => (
                        <FieldGroup key={key} label={label}>
                            <div className="relative">
                                <input
                                    type={showPwd[key] ? 'text' : 'password'}
                                    className="form-input pr-10"
                                    value={pwd[field]}
                                    onChange={e => setPwd(s => ({ ...s, [field]: e.target.value }))}
                                    required
                                    minLength={field === 'currentPassword' ? 1 : 6}
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleShow(key)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                                >
                                    {showPwd[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </FieldGroup>
                    ))}
                    <div className="pt-1">
                        <SaveButton loading={pwdLoading} label="Change Password" />
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Clinic Tab ───────────────────────────────────────────────────────────────

function ClinicTab() {
    const { showToast } = useToast();
    const [form, setForm] = useState({ clinic_name: '', address: '', phone: '', email: '', website: '' });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        client.get('/settings/clinic')
            .then(res => setForm({
                clinic_name: res.data.clinic_name || '',
                address: res.data.address || '',
                phone: res.data.phone || '',
                email: res.data.email || '',
                website: res.data.website || '',
            }))
            .catch(() => showToast('Failed to load clinic info', 'error'))
            .finally(() => setFetching(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await client.put('/settings/clinic', form);
            showToast('Clinic info saved', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save clinic info', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="card space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-10 rounded" />)}
            </div>
        );
    }

    return (
        <div className="card">
            <SectionTitle>Clinic Information</SectionTitle>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FieldGroup label="Clinic Name">
                    <input
                        className="form-input"
                        value={form.clinic_name}
                        onChange={e => setForm(s => ({ ...s, clinic_name: e.target.value }))}
                        required
                    />
                </FieldGroup>
                <FieldGroup label="Address">
                    <textarea
                        className="form-input resize-none"
                        rows={2}
                        value={form.address}
                        onChange={e => setForm(s => ({ ...s, address: e.target.value }))}
                    />
                </FieldGroup>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldGroup label="Phone">
                        <input
                            className="form-input"
                            value={form.phone}
                            onChange={e => setForm(s => ({ ...s, phone: e.target.value }))}
                        />
                    </FieldGroup>
                    <FieldGroup label="Email">
                        <input
                            type="email"
                            className="form-input"
                            value={form.email}
                            onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                        />
                    </FieldGroup>
                </div>
                <FieldGroup label="Website">
                    <input
                        className="form-input"
                        placeholder="https://..."
                        value={form.website}
                        onChange={e => setForm(s => ({ ...s, website: e.target.value }))}
                    />
                </FieldGroup>
                <div className="pt-1">
                    <SaveButton loading={loading} />
                </div>
            </form>
        </div>
    );
}

// ─── User Modal ───────────────────────────────────────────────────────────────

function UserModal({ user, onClose, onSaved }) {
    const { showToast } = useToast();
    const isEdit = !!user;
    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        username: user?.username || '',
        email: user?.email || '',
        password: '',
        role: user?.role || 'dentist',
    });
    const [loading, setLoading] = useState(false);
    const [showPwd, setShowPwd] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEdit) {
                const res = await client.put(`/settings/users/${user.id}`, {
                    full_name: form.full_name,
                    email: form.email,
                    role: form.role,
                });
                onSaved(res.data, 'update');
            } else {
                const res = await client.post('/settings/users', form);
                onSaved(res.data, 'create');
            }
            onClose();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save user', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6"
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-lg text-text-primary">
                        {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
                    </h2>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FieldGroup label="Full Name">
                        <input
                            className="form-input"
                            value={form.full_name}
                            onChange={e => setForm(s => ({ ...s, full_name: e.target.value }))}
                            required
                        />
                    </FieldGroup>
                    {!isEdit && (
                        <FieldGroup label="Username">
                            <input
                                className="form-input"
                                value={form.username}
                                onChange={e => setForm(s => ({ ...s, username: e.target.value }))}
                                required
                                minLength={3}
                            />
                        </FieldGroup>
                    )}
                    <FieldGroup label="Email">
                        <input
                            type="email"
                            className="form-input"
                            value={form.email}
                            onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                            required
                        />
                    </FieldGroup>
                    {!isEdit && (
                        <FieldGroup label="Password">
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    className="form-input pr-10"
                                    value={form.password}
                                    onChange={e => setForm(s => ({ ...s, password: e.target.value }))}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                                >
                                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </FieldGroup>
                    )}
                    <FieldGroup label="Role">
                        <select
                            className="form-input"
                            value={form.role}
                            onChange={e => setForm(s => ({ ...s, role: e.target.value }))}
                        >
                            {ROLES.map(r => (
                                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                        </select>
                    </FieldGroup>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
                        <button type="submit" disabled={loading} className="btn-primary flex-1">
                            {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Staff')}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
    const { admin } = useAuth();
    const { showToast } = useToast();
    const isAdmin = admin?.role === 'admin';

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'add' | user object

    useEffect(() => {
        if (!isAdmin) { setLoading(false); return; }
        client.get('/settings/users')
            .then(res => setUsers(res.data))
            .catch(() => showToast('Failed to load users', 'error'))
            .finally(() => setLoading(false));
    }, [isAdmin]);

    const handleSaved = (saved, type) => {
        if (type === 'create') {
            setUsers(u => [...u, saved]);
            showToast('Staff member added', 'success');
        } else {
            setUsers(u => u.map(x => x.id === saved.id ? { ...x, ...saved } : x));
            showToast('Staff member updated', 'success');
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            const res = await client.patch(`/settings/users/${user.id}/status`);
            setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: res.data.is_active } : x));
            showToast(`${user.full_name} ${res.data.is_active ? 'activated' : 'deactivated'}`, 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update status', 'error');
        }
    };

    const roleBadgeColor = {
        admin: 'bg-purple-100 text-purple-700',
        dentist: 'bg-blue-100 text-blue-700',
        hygienist: 'bg-teal-100 text-teal-700',
        receptionist: 'bg-amber-100 text-amber-700',
    };

    return (
        <>
            <div className="card p-0 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck className="w-4 h-4 text-text-secondary" />
                        <span className="font-semibold text-text-primary">Staff Members</span>
                        <span className="text-text-secondary text-sm">({users.length})</span>
                    </div>
                    {isAdmin && (
                        <button onClick={() => setModal('add')} className="btn-primary text-sm w-full sm:w-auto">
                            <Plus className="w-4 h-4" /> Add Staff
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-bg/80 border-b border-border">
                            <tr>
                                {['Name', 'Username', 'Role', 'Status', 'Last Login', ...(isAdmin ? ['Actions'] : [])].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="border-b border-border/50">
                                        {[1, 2, 3, 4, 5, 6].map(j => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="skeleton h-4 rounded w-3/4" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : users.map(u => (
                                <tr key={u.id} className="border-b border-border/50 hover:bg-bg/40 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                {u.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-text-primary">{u.full_name}</span>
                                            {u.id === admin?.id && (
                                                <span className="text-xs text-text-secondary">(you)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-text-secondary">{u.username}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor[u.role] || 'bg-gray-100 text-gray-700'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'badge-green' : 'bg-gray-100 text-gray-500'}`}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-text-secondary">
                                        {u.last_login ? formatDate(u.last_login) : 'Never'}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setModal(u)}
                                                    className="btn-icon"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {u.id !== admin?.id && (
                                                    <button
                                                        onClick={() => handleToggleStatus(u)}
                                                        className="btn-icon"
                                                        title={u.is_active ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {u.is_active
                                                            ? <ToggleRight className="w-4 h-4 text-primary" />
                                                            : <ToggleLeft className="w-4 h-4 text-text-secondary" />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {modal && (
                    <UserModal
                        user={modal === 'add' ? null : modal}
                        onClose={() => setModal(null)}
                        onSaved={handleSaved}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ─── Reusable form-settings card ─────────────────────────────────────────────

function FormSettingsCard({
    title, description, formPath,
    enabled, slug, redirectUrl,
    onToggle, onSlugChange, onRedirectChange,
    onRegenerate, onSave,
    saving, regenerating, copied, onCopy,
}) {
    const formUrl = slug ? `${window.location.origin}/${formPath}/${slug}` : '';

    return (
        <form onSubmit={onSave} className="space-y-5">
            {/* Enable toggle */}
            <div className="card">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{title}</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                            {enabled
                                ? 'Active — patients with the link can access and submit'
                                : 'Disabled — patients will see a "Form Unavailable" page'}
                        </p>
                    </div>
                    <button type="button" onClick={onToggle} className="shrink-0" title={enabled ? 'Disable' : 'Enable'}>
                        {enabled
                            ? <ToggleRight className="w-11 h-11 text-primary" />
                            : <ToggleLeft className="w-11 h-11 text-text-secondary" />}
                    </button>
                </div>
            </div>

            {/* URL */}
            <div className="card space-y-5">
                <div className="flex items-center gap-2 mb-1">
                    <Link2 className="w-4 h-4 text-text-secondary" />
                    <SectionTitle>Form URL</SectionTitle>
                </div>
                <FieldGroup label="Current Link">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input className="form-input flex-1 font-mono text-xs bg-surface cursor-default select-all"
                            value={formUrl || 'Save a slug below to generate the URL'} readOnly />
                        <button type="button" className="btn-secondary shrink-0 gap-1.5 w-full sm:w-auto" onClick={onCopy} disabled={!formUrl}>
                            {copied ? <><Check className="w-4 h-4 text-green-600" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                        </button>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                        Share this link with patients. Keep it private — anyone with the link can submit.
                    </p>
                </FieldGroup>

                {formUrl && enabled && (
                    <div className="flex flex-col sm:flex-row items-center gap-5 pt-4 border-t border-border">
                        <div className="p-3 bg-white border border-border rounded-xl shadow-sm shrink-0">
                            <QRCodeSVG
                                className="qr-download-target"
                                value={formUrl}
                                size={140}
                                fgColor="#051f19"
                                bgColor="#ffffff"
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <p className="text-sm font-medium text-text-primary">QR Code</p>
                            <p className="text-xs text-text-secondary">
                                Print or display this QR code at the front desk. Patients scan it with their phone camera to open the registration form on their own device — no URL needed.
                            </p>
                            <button
                                type="button"
                                className="btn-secondary text-xs gap-1.5"
                                onClick={() => {
                                    const svg = document.querySelector('.qr-download-target');
                                    if (!svg) return;
                                    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `${formPath}-qr.svg`;
                                    a.click();
                                }}
                            >
                                <Download className="w-3.5 h-3.5" /> Download QR
                            </button>
                        </div>
                    </div>
                )}

                <FieldGroup label="URL Slug">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex flex-1 items-stretch min-w-0">
                            <span className="px-3 py-2 bg-surface border border-border border-r-0 rounded-l-xl text-sm text-text-secondary whitespace-nowrap">
                                /{formPath}/
                            </span>
                            <input className="form-input rounded-l-none flex-1 min-w-0 font-mono"
                                value={slug}
                                onChange={e => onSlugChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                                placeholder="abc123xyz" minLength={3} maxLength={50} required />
                        </div>
                        <button type="button" className="btn-secondary shrink-0 gap-1.5 w-full sm:w-auto"
                            onClick={onRegenerate} disabled={regenerating} title="Generate a new random slug">
                            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                            {regenerating ? '' : 'Regenerate'}
                        </button>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                        Letters, numbers, hyphens, underscores only. Change anytime to invalidate old links.
                    </p>
                </FieldGroup>
            </div>

            {/* Redirect */}
            <div className="card space-y-4">
                <SectionTitle>Post-Submission Redirect</SectionTitle>
                <FieldGroup label="Redirect URL (optional)">
                    <input type="url" className="form-input" value={redirectUrl}
                        onChange={e => onRedirectChange(e.target.value)}
                        placeholder="https://example.com/thank-you" />
                </FieldGroup>
                <p className="text-xs text-text-secondary">
                    If set, patients are redirected here 2.5 seconds after submission. Leave blank to show the built-in thank-you screen.
                </p>
            </div>

            <div className="flex justify-end">
                <div className="w-full sm:w-auto">
                    <SaveButton loading={saving} />
                </div>
            </div>
        </form>
    );
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────

// ─── Kiosk Tab ────────────────────────────────────────────────────────────────

function KioskCard() {
    const { showToast } = useToast();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState('');

    const kioskUrl = `${window.location.origin}/kiosk`;

    useEffect(() => {
        client.get('/settings/kiosk')
            .then(res => setToken(res.data.kiosk_token || ''))
            .catch(() => showToast('Failed to load kiosk settings', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const regenerate = async () => {
        if (!window.confirm('Regenerate the access token? The current token will stop working immediately and you will need to re-enter the new token on the kiosk device.')) return;
        setRegenerating(true);
        try {
            const res = await client.post('/settings/kiosk/regenerate');
            setToken(res.data.kiosk_token);
            showToast('New kiosk token generated', 'success');
        } catch { showToast('Failed to regenerate', 'error'); }
        finally { setRegenerating(false); }
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(kioskUrl);
        setCopied('url');
        setTimeout(() => setCopied(''), 2000);
    };

    const copyToken = () => {
        navigator.clipboard.writeText(token);
        setCopied('token');
        setTimeout(() => setCopied(''), 2000);
    };

    if (loading) {
        return <div className="card space-y-4">{[1, 2].map(i => <div key={i} className="skeleton h-10 rounded" />)}</div>;
    }

    return (
        <div className="space-y-5">
            <div className="card">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Tablet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-semibold text-text-primary">Clinic iPad / Kiosk</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                            A dedicated registration form for in-clinic use. No rate limiting — designed for a shared device at the front desk.
                            Open the kiosk URL on the iPad, then enter the access token once to activate the device. Future visits will skip the setup screen.
                        </p>
                    </div>
                </div>
            </div>

            <div className="card space-y-5">
                <div className="flex items-center gap-2 mb-1">
                    <Link2 className="w-4 h-4 text-text-secondary" />
                    <SectionTitle>Kiosk Setup</SectionTitle>
                </div>
                <FieldGroup label="Step 1 — Open this URL on the iPad">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input className="form-input flex-1 font-mono text-xs bg-surface cursor-default select-all"
                            value={kioskUrl} readOnly />
                        <button type="button" className="btn-secondary shrink-0 gap-1.5 w-full sm:w-auto" onClick={copyUrl}>
                            {copied === 'url' ? <><Check className="w-4 h-4 text-green-600" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                        </button>
                    </div>
                </FieldGroup>
                <FieldGroup label="Step 2 — Enter this access token on the device">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input className="form-input flex-1 font-mono text-sm bg-surface cursor-default select-all tracking-widest"
                            value={token || 'Generating…'} readOnly />
                        <button type="button" className="btn-secondary shrink-0 gap-1.5 w-full sm:w-auto" onClick={copyToken} disabled={!token}>
                            {copied === 'token' ? <><Check className="w-4 h-4 text-green-600" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                        </button>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                        Keep this token private — it acts as the password for the kiosk device. The token is saved on the device after first entry.
                    </p>
                </FieldGroup>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
                    <p className="text-xs text-text-secondary">Regenerating invalidates the old token. You will need to re-enter the new token on the kiosk iPad.</p>
                    <button type="button" className="btn-secondary gap-1.5 shrink-0 w-full sm:w-auto"
                        onClick={regenerate} disabled={regenerating}>
                        <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                        {regenerating ? 'Regenerating…' : 'Regenerate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormsTab() {
    const { showToast } = useToast();
    const { admin } = useAuth();
    const isAdmin = admin?.role === 'admin';
    const [activeForm, setActiveForm] = useState('intake');

    // ── Intake form state ──────────────────────────────────────────────────────
    const [intake, setIntake] = useState({ enabled: true, slug: '', redirect: '' });
    const [intakeLoading, setIntakeLoading] = useState(true);
    const [intakeSaving, setIntakeSaving] = useState(false);
    const [intakeRegen, setIntakeRegen] = useState(false);
    const [intakeCopied, setIntakeCopied] = useState(false);

    useEffect(() => {
        client.get('/settings/intake')
            .then(res => setIntake({
                enabled: res.data.intake_enabled ?? true,
                slug: res.data.intake_slug || '',
                redirect: res.data.intake_redirect_url || '',
            }))
            .catch(() => showToast('Failed to load intake settings', 'error'))
            .finally(() => setIntakeLoading(false));
    }, []);

    const saveIntake = async (e) => {
        e.preventDefault();
        setIntakeSaving(true);
        try {
            const res = await client.put('/settings/intake', {
                intake_enabled: intake.enabled,
                intake_slug: intake.slug.trim(),
                intake_redirect_url: intake.redirect || null,
            });
            setIntake(s => ({ ...s, slug: res.data.intake_slug, enabled: res.data.intake_enabled }));
            showToast('New patient form settings saved', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save', 'error');
        } finally {
            setIntakeSaving(false);
        }
    };

    const regenIntake = async () => {
        setIntakeRegen(true);
        try {
            const res = await client.post('/settings/intake/regenerate');
            setIntake(s => ({ ...s, slug: res.data.intake_slug }));
            showToast('New intake URL generated — remember to save', 'success');
        } catch { showToast('Failed to regenerate', 'error'); }
        finally { setIntakeRegen(false); }
    };

    const copyIntake = () => {
        const url = `${window.location.origin}/intake/${intake.slug}`;
        navigator.clipboard.writeText(url);
        setIntakeCopied(true);
        setTimeout(() => setIntakeCopied(false), 2000);
    };

    // ── Appointment form state ─────────────────────────────────────────────────
    const [appt, setAppt] = useState({ enabled: true, slug: '', redirect: '' });
    const [apptLoading, setApptLoading] = useState(true);
    const [apptSaving, setApptSaving] = useState(false);
    const [apptRegen, setApptRegen] = useState(false);
    const [apptCopied, setApptCopied] = useState(false);

    useEffect(() => {
        client.get('/settings/appt-form')
            .then(res => setAppt({
                enabled: res.data.appt_form_enabled ?? true,
                slug: res.data.appt_form_slug || '',
                redirect: res.data.appt_form_redirect_url || '',
            }))
            .catch(() => showToast('Failed to load appointment form settings', 'error'))
            .finally(() => setApptLoading(false));
    }, []);

    const saveAppt = async (e) => {
        e.preventDefault();
        setApptSaving(true);
        try {
            const res = await client.put('/settings/appt-form', {
                appt_form_enabled: appt.enabled,
                appt_form_slug: appt.slug.trim(),
                appt_form_redirect_url: appt.redirect || null,
            });
            setAppt(s => ({ ...s, slug: res.data.appt_form_slug, enabled: res.data.appt_form_enabled }));
            showToast('Appointment form settings saved', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save', 'error');
        } finally {
            setApptSaving(false);
        }
    };

    const regenAppt = async () => {
        setApptRegen(true);
        try {
            const res = await client.post('/settings/appt-form/regenerate');
            setAppt(s => ({ ...s, slug: res.data.appt_form_slug }));
            showToast('New appointment form URL generated — remember to save', 'success');
        } catch { showToast('Failed to regenerate', 'error'); }
        finally { setApptRegen(false); }
    };

    const copyAppt = () => {
        const url = `${window.location.origin}/appointment/${appt.slug}`;
        navigator.clipboard.writeText(url);
        setApptCopied(true);
        setTimeout(() => setApptCopied(false), 2000);
    };

    if (intakeLoading || apptLoading) {
        return (
            <div className="space-y-4">
                <div className="card space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sub-tab switcher */}
            <div className="flex gap-1 bg-bg border border-border rounded-xl p-1 w-full max-w-full overflow-x-auto sm:w-fit">
                {[
                    { key: 'intake', label: 'New Patient Form' },
                    { key: 'appointment', label: 'Appointment Request Form' },
                    ...(isAdmin ? [{ key: 'kiosk', label: 'Clinic Kiosk' }] : []),
                ].map(tab => (
                    <button key={tab.key} type="button"
                        onClick={() => setActiveForm(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeForm === tab.key
                                ? 'bg-white text-text-primary shadow-sm'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeForm === 'intake' && (
                <FormSettingsCard
                    title="New Patient Registration Form"
                    description="For first-time patients to register their information."
                    formPath="intake"
                    enabled={intake.enabled}
                    slug={intake.slug}
                    redirectUrl={intake.redirect}
                    onToggle={() => setIntake(s => ({ ...s, enabled: !s.enabled }))}
                    onSlugChange={v => setIntake(s => ({ ...s, slug: v }))}
                    onRedirectChange={v => setIntake(s => ({ ...s, redirect: v }))}
                    onRegenerate={regenIntake}
                    onSave={saveIntake}
                    saving={intakeSaving}
                    regenerating={intakeRegen}
                    copied={intakeCopied}
                    onCopy={copyIntake}
                />
            )}

            {activeForm === 'appointment' && (
                <FormSettingsCard
                    title="Appointment Request Form"
                    description="For returning patients to request an appointment."
                    formPath="appointment"
                    enabled={appt.enabled}
                    slug={appt.slug}
                    redirectUrl={appt.redirect}
                    onToggle={() => setAppt(s => ({ ...s, enabled: !s.enabled }))}
                    onSlugChange={v => setAppt(s => ({ ...s, slug: v }))}
                    onRedirectChange={v => setAppt(s => ({ ...s, redirect: v }))}
                    onRegenerate={regenAppt}
                    onSave={saveAppt}
                    saving={apptSaving}
                    regenerating={apptRegen}
                    copied={apptCopied}
                    onCopy={copyAppt}
                />
            )}

            {activeForm === 'kiosk' && isAdmin && <KioskCard />}
        </div>
    );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Settings() {
    const { admin } = useAuth();
    const isAdmin = admin?.role === 'admin';
    const TABS = ALL_TABS.filter(t => !t.adminOnly || isAdmin);
    const [activeTab, setActiveTab] = useState('account');

    return (
        <div className="space-y-6 animate-fade-up">
            <div>
                <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
                <p className="text-text-secondary text-sm">Manage your account, clinic info, and staff</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-bg border border-border rounded-xl p-1 w-full max-w-full overflow-x-auto sm:w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-white text-text-primary shadow-sm'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...fadeUp}>
                    {activeTab === 'account' && <AccountTab />}
                    {activeTab === 'clinic' && <ClinicTab />}
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'forms' && <FormsTab />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
