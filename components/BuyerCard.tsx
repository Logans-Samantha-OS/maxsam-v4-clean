'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Buyer {
    id: string;
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    counties_interested?: string[];
    property_types?: string[];
    min_price?: number;
    max_price?: number;
    is_active?: boolean;
    notes?: string;
    created_at: string;
    updated_at: string;
}

interface BuyerCardProps {
    buyer: Buyer;
    onUpdate: (updatedBuyer: Buyer) => void;
}

export default function BuyerCard({ buyer, onUpdate }: BuyerCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempBuyer, setTempBuyer] = useState(buyer);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('maxsam_buyers')
                .update({
                    name: tempBuyer.name,
                    company_name: tempBuyer.company_name,
                    email: tempBuyer.email,
                    phone: tempBuyer.phone,
                    min_price: tempBuyer.min_price,
                    max_price: tempBuyer.max_price,
                    notes: tempBuyer.notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', buyer.id)
                .select()
                .single();

            if (error) throw error;
            onUpdate(data);
            setIsEditing(false);
        } catch (e) {
            console.error('Error saving buyer', e);
            alert('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleSendMatches = async () => {
        // Determine which endpoint to use - checking file system suggested /api/buyers/send-matches
        try {
            const res = await fetch('/api/buyers/send-matches', {
                method: 'POST',
                body: JSON.stringify({ buyer_id: buyer.id })
            });
            if (res.ok) alert('Matches sent!');
            else alert('Failed to send matches');
        } catch (e) {
            console.error(e);
            alert('Error sending matches');
        }
    };

    return (
        <div className="pharaoh-card hover:border-emerald-500/50 transition-all duration-300 relative group">
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        {isEditing ? (
                            <div className="space-y-2">
                                <input
                                    value={tempBuyer.name}
                                    onChange={(e) => setTempBuyer({ ...tempBuyer, name: e.target.value })}
                                    className="bg-zinc-800 border-zinc-700 text-white p-1 rounded w-full font-bold"
                                    placeholder="Name"
                                />
                                <input
                                    value={tempBuyer.company_name || ''}
                                    onChange={(e) => setTempBuyer({ ...tempBuyer, company_name: e.target.value })}
                                    className="bg-zinc-800 border-zinc-700 text-emerald-400 p-1 rounded w-full text-sm"
                                    placeholder="Company"
                                />
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-white mb-1">{buyer.name}</h3>
                                {buyer.company_name && (
                                    <p className="text-emerald-400 font-medium">{buyer.company_name}</p>
                                )}
                            </>
                        )}
                    </div>
                    <div className="text-right">
                        <button
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            className={`text-xs px-2 py-1 rounded ${isEditing ? 'bg-green-500 text-white' : 'text-zinc-500 hover:text-gold'}`}
                        >
                            {saving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
                        </button>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="mb-4">
                    {isEditing ? (
                        <div className="space-y-2">
                            <input
                                value={tempBuyer.email || ''}
                                onChange={(e) => setTempBuyer({ ...tempBuyer, email: e.target.value })}
                                className="bg-zinc-800 border-zinc-700 text-white p-1 rounded w-full text-sm"
                                placeholder="Email"
                            />
                            <input
                                value={tempBuyer.phone || ''}
                                onChange={(e) => setTempBuyer({ ...tempBuyer, phone: e.target.value })}
                                className="bg-zinc-800 border-zinc-700 text-white p-1 rounded w-full text-sm"
                                placeholder="Phone"
                            />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-zinc-400 text-sm">Email:</span>
                                <a href={`mailto:${buyer.email}`} className="text-white font-medium hover:text-emerald-400">{buyer.email || 'No email'}</a>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-zinc-400 text-sm">Phone:</span>
                                <a href={`tel:${buyer.phone}`} className="text-white font-medium hover:text-emerald-400">{buyer.phone || 'No phone'}</a>
                            </div>
                        </>
                    )}
                </div>

                {/* Budget */}
                <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-zinc-400 text-sm mb-1">Budget Range</div>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={tempBuyer.min_price || ''}
                                onChange={(e) => setTempBuyer({ ...tempBuyer, min_price: parseInt(e.target.value) })}
                                className="bg-zinc-700 border-zinc-600 text-white p-1 rounded w-24 text-sm"
                                placeholder="Min"
                            />
                            <span className="text-zinc-500">-</span>
                            <input
                                type="number"
                                value={tempBuyer.max_price || ''}
                                onChange={(e) => setTempBuyer({ ...tempBuyer, max_price: parseInt(e.target.value) })}
                                className="bg-zinc-700 border-zinc-600 text-white p-1 rounded w-24 text-sm"
                                placeholder="Max"
                            />
                        </div>
                    ) : (
                        <div className="text-xl font-bold text-emerald-400">
                            ${buyer.min_price?.toLocaleString() || '0'} - ${buyer.max_price?.toLocaleString() || '∞'}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {!isEditing && (
                    <div className="grid grid-cols-3 gap-2">
                        <a
                            href={`tel:${buyer.phone}`}
                            className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <span>📞</span>
                            <span className="hidden md:inline">Call</span>
                        </a>
                        <a
                            href={`mailto:${buyer.email}`}
                            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <span>📧</span>
                            <span className="hidden md:inline">Email</span>
                        </a>
                        <button
                            onClick={handleSendMatches}
                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <span>🎯</span>
                            <span className="hidden md:inline">Matches</span>
                        </button>
                    </div>
                )}

                {/* Notes */}
                {(buyer.notes || isEditing) && (
                    <div className="mt-4 pt-4 border-t border-zinc-700">
                        <p className="text-zinc-400 text-sm mb-1">Notes:</p>
                        {isEditing ? (
                            <textarea
                                value={tempBuyer.notes || ''}
                                onChange={(e) => setTempBuyer({ ...tempBuyer, notes: e.target.value })}
                                className="w-full bg-zinc-800 border-zinc-700 text-zinc-300 text-sm rounded p-2 h-20"
                            />
                        ) : (
                            <p className="text-zinc-300 text-sm">{buyer.notes}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
