import { getMyBusiness } from '@/lib/auth-actions';
import { createSupabaseServerClient } from '@/lib/supabase';
import { Users, Phone, Clock } from 'lucide-react';
export default async function LeadsPage() {
  const business = await getMyBusiness();
  const supabase = createSupabaseServerClient();

  const { data: leads } = business
    ? await supabase.from('leads').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
    : { data: [] };

  console.log(leads, 'leads');

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">{leads?.length ?? 0} contacts captured by your AI agent</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!leads || leads.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No leads yet</p>
            <p className="text-sm text-muted-foreground mt-1">When your AI agent captures a phone number, it'll appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leads.map(lead => (
              <div key={lead.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm">{lead.client_phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(lead.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
                {lead.chat_summary && (
                  <div className="ml-10 bg-muted rounded-lg px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium mb-2">Chat summary</p>
                    <div className="text-xs text-foreground space-y-1.5 font-sans leading-relaxed">
                      {lead.chat_summary.split('\n').map((line: string, index: number) => {
                        // Skip completely empty lines
                        if (!line.trim()) return null;

                        // Check if the line highlights a speaker role
                        const isAssistant = line.startsWith('assistant:');
                        const isUser = line.startsWith('user:');

                        if (isAssistant || isUser) {
                          const role = isAssistant ? 'assistant:' : 'user:';
                          const content = line.substring(role.length);

                          return (
                            <div key={index} className="pt-0.5">
              <span className={`font-bold capitalize ${isAssistant ? 'text-primary' : 'text-foreground'}`}>
                {role}{' '}
              </span>
                              <span>{content.replace(/\*\*/g, '')}</span>
                            </div>
                          );
                        }

                        // Handle nested bulleted lists or sub-details nicely
                        const isBullet = line.trim().startsWith('-');
                        return (
                          <div
                            key={index}
                            className={`text-muted-foreground ${isBullet ? 'pl-4 text-foreground/90' : 'pl-2'}`}
                          >
                            {line.replace(/\*\*/g, '')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
