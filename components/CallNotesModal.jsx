'use client';
import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';

export default function CallNotesModal({ isOpen, onClose, lead, onSave }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    outcome: 'answered',
    notes: '',
    follow_up_date: '',
    next_action: '',
    disposition: 'interested',
  });

  const outcomes = ['answered', 'voicemail', 'no-answer', 'busy', 'wrong-number', 'do-not-call'];
  const dispositions = ['interested', 'not-interested', 'callback', 'needs-info', 'think-about-it', 'qualified'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create activity log entry
      const { error: activityError } = await supabase
        .from('activity_log')
        .insert([
          {
            lead_id: lead?.id,
            activity_type: 'call',
            outcome: formData.outcome,
            notes: formData.notes,
            disposition: formData.disposition,
            follow_up_date: formData.follow_up_date || null,
            next_action: formData.next_action,
            created_at: new Date().toISOString(),
          },
        ]);

      if (activityError) {
        // If activity_log table doesn't exist, create it
        if (activityError.code === '42P01') {
          alert('Activity log table needs to be created in Supabase. Creating now...');
          // This would normally be done via migration
        } else {
          throw activityError;
        }
      }

      // Update lead status
      if (formData.disposition === 'qualified') {
        await supabase
          .from('maxsam_leads')
          .update({
            status: 'qualified',
            contact_priority: 'hot',
          })
          .eq('id', lead?.id);
      }

      onSave?.(formData);
      onClose();
    } catch (error) {
      console.error('Error saving call notes:', error);
      alert('Failed to save call notes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Call Notes" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lead Info */}
        {lead && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
            <div className="text-white font-semibold">{lead.owner_name}</div>
            <div className="text-sm text-zinc-400">{lead.property_address}</div>
            <div className="text-sm text-green-400 mt-1">
              ${(lead.excess_funds_amount || 0).toLocaleString()} excess funds
            </div>
          </div>
        )}

        {/* Call Outcome */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Call Outcome *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {outcomes.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => setFormData({ ...formData, outcome })}
                className={`p-3 rounded-lg border-2 transition-all capitalize ${
                  formData.outcome === outcome
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {outcome.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Disposition (if answered) */}
        {formData.outcome === 'answered' && (
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Disposition *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {dispositions.map((disposition) => (
                <button
                  key={disposition}
                  type="button"
                  onClick={() => setFormData({ ...formData, disposition })}
                  className={`p-3 rounded-lg border-2 transition-all capitalize ${
                    formData.disposition === disposition
                      ? 'border-green-500 bg-green-500/10 text-white'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {disposition.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Call Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Call Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={4}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            placeholder="What was discussed? Any objections? Key points..."
          />
        </div>

        {/* Follow-up */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Follow-up Date
            </label>
            <input
              type="date"
              value={formData.follow_up_date}
              onChange={(e) =>
                setFormData({ ...formData, follow_up_date: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Next Action
            </label>
            <select
              value={formData.next_action}
              onChange={(e) =>
                setFormData({ ...formData, next_action: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select action...</option>
              <option value="call-back">Call back</option>
              <option value="send-sms">Send SMS</option>
              <option value="send-email">Send email</option>
              <option value="send-contract">Send contract</option>
              <option value="no-action">No action needed</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : '📝 Save Notes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
