'use client';
import { useState } from 'react';
import Modal from './Modal';

export default function SMSTemplateModal({ isOpen, onClose, lead, onSend }) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const templates = {
    initial: {
      name: 'Initial Contact',
      message:
        "Hi {{name}}, this is Logan with MaxSam. I'm reaching out about excess funds from your property at {{address}}. We can help you recover ${{amount}}. When's a good time to talk?",
    },
    followup: {
      name: 'Follow-Up',
      message:
        'Hi {{name}}, following up on my message about the ${{amount}} in excess funds from {{address}}. Have you had a chance to think about it?',
    },
    callback: {
      name: 'Schedule Callback',
      message:
        "Hi {{name}}, thanks for your interest! What time works best for a quick call to discuss recovering your ${{amount}}?",
    },
    urgent: {
      name: 'Urgent - Deadline',
      message:
        "URGENT: {{name}}, there's a deadline approaching to claim your ${{amount}} from {{address}}. Can we talk today?",
    },
    wholesale: {
      name: 'Wholesale Opportunity',
      message:
        'Hi {{name}}, in addition to your excess funds, I have buyers interested in {{address}}. Possible to do both deals together for maximum value?',
    },
  };

  const fillTemplate = (template) => {
    if (!lead) return template;
    return template
      .replace('{{name}}', lead.owner_name || 'there')
      .replace(/{{address}}/g, lead.property_address || 'your property')
      .replace(/{{amount}}/g, (lead.excess_funds_amount || 0).toLocaleString());
  };

  const handleSelectTemplate = (key) => {
    setSelectedTemplate(key);
    setCustomMessage(fillTemplate(templates[key].message));
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // TODO: Integrate with Twilio API
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      onSend?.(customMessage);
      onClose();
    } catch (error) {
      alert('Failed to send SMS: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send SMS" size="lg">
      <div className="space-y-6">
        {/* Lead Info */}
        {lead && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{lead.owner_name}</div>
                <div className="text-sm text-zinc-400">{lead.property_address}</div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-semibold">
                  ${(lead.excess_funds_amount || 0).toLocaleString()}
                </div>
                <div className="text-sm text-zinc-400">{lead.phone}</div>
              </div>
            </div>
          </div>
        )}

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Quick Templates
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(templates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => handleSelectTemplate(key)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  selectedTemplate === key
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-white font-medium text-sm">{template.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message Editor */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Message
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            placeholder="Type your message..."
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-zinc-400">
              {customMessage.length} characters
            </span>
            <span className="text-xs text-zinc-400">
              ~{Math.ceil(customMessage.length / 160)} SMS
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !customMessage || !lead?.phone}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : '📱 Send SMS'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
