import { Copy, Edit, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileVaultLogo } from "@/components/MobileVaultLogo";

export type Stage = 'disconnected' | 'connecting' | 'connected';

export interface VaultAttribute {
  name: string;
  value: string;
  isSecret: boolean;
}

export interface VaultEntry {
  id: string;
  group: string;
  url: string;
  description: string;
  attributes: VaultAttribute[];
}

export interface PasswordGenConfig {
  minLength: number;
  maxLength: number;
  minSpecialChars: number;
  excludeChars: string;
  excludePattern: string;
  matchPattern: string;
}

export interface VaultViewProps {
  stage: Stage;
  vaultEntries: VaultEntry[];
  searchQuery: string;
  formData: {
    group: string;
    url: string;
    description: string;
    attributes: VaultAttribute[];
  };
  passwordConfig: PasswordGenConfig;
  generatedPassword: string;
  showPasswordGen: boolean;
  activeSecretField: { entryId?: string; attrIndex?: number } | null;
  qrData: string;

  // Handlers
  onConnect: () => void;
  onSearchChange: (query: string) => void;
  onFormChange: (field: string, value: any) => void;
  onAddAttribute: () => void;
  onUpdateAttribute: (index: number, field: keyof VaultAttribute, value: string | boolean) => void;
  onRemoveAttribute: (index: number) => void;
  onSubmitEntry: () => void;
  onEditEntry: (id: string) => void;
  onPasswordConfigChange: (field: string, value: any) => void;
  onGeneratePassword: () => void;
  onUseGeneratedPassword: () => void;
  onClosePasswordGen: () => void;
  onCopyToClipboard: (text: string) => void;
  onPasswordGenOpen: (attrIndex: number) => void;

  // Styling props
  containerClassName?: string;
  popupSize?: boolean; // true for extension size, false for full-screen web
}

export function VaultView({
  stage,
  vaultEntries,
  searchQuery,
  formData,
  passwordConfig,
  generatedPassword,
  showPasswordGen,
  activeSecretField,
  qrData,
  onConnect,
  onSearchChange,
  onFormChange,
  onAddAttribute,
  onUpdateAttribute,
  onRemoveAttribute,
  onSubmitEntry,
  onEditEntry,
  onPasswordConfigChange,
  onGeneratePassword,
  onUseGeneratedPassword,
  onClosePasswordGen,
  onCopyToClipboard,
  onPasswordGenOpen,
  containerClassName = "",
  popupSize = true,
}: VaultViewProps) {
  const filteredEntries = vaultEntries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    return (
      entry.group.toLowerCase().includes(query) ||
      entry.url.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query) ||
      entry.attributes.some((attr) => attr.name.toLowerCase().includes(query))
    );
  });

  const renderPasswordGenerator = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Password Generator</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClosePasswordGen}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minLength">Min Length</Label>
              <Input
                id="minLength"
                type="number"
                value={passwordConfig.minLength}
                onChange={(e) => onPasswordConfigChange('minLength', parseInt(e.target.value) || 8)}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="maxLength">Max Length</Label>
              <Input
                id="maxLength"
                type="number"
                value={passwordConfig.maxLength}
                onChange={(e) => onPasswordConfigChange('maxLength', parseInt(e.target.value) || 24)}
                className="h-8"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="minSpecialChars">Min Special Characters</Label>
            <Input
              id="minSpecialChars"
              type="number"
              value={passwordConfig.minSpecialChars}
              onChange={(e) => onPasswordConfigChange('minSpecialChars', parseInt(e.target.value) || 0)}
              className="h-8"
            />
          </div>

          <div>
            <Label htmlFor="excludeChars">Exclude Characters</Label>
            <Input
              id="excludeChars"
              value={passwordConfig.excludeChars}
              onChange={(e) => onPasswordConfigChange('excludeChars', e.target.value)}
              className="h-8"
              placeholder="e.g. 0O1l"
            />
          </div>

          <div>
            <Label htmlFor="excludePattern">Exclude Pattern (regex)</Label>
            <Input
              id="excludePattern"
              value={passwordConfig.excludePattern}
              onChange={(e) => onPasswordConfigChange('excludePattern', e.target.value)}
              className="h-8"
              placeholder="e.g. ^[0-9]+$"
            />
          </div>

          <div>
            <Label htmlFor="matchPattern">Match Pattern (regex)</Label>
            <Input
              id="matchPattern"
              value={passwordConfig.matchPattern}
              onChange={(e) => onPasswordConfigChange('matchPattern', e.target.value)}
              className="h-8"
              placeholder="e.g. ^(?=.*[A-Za-z])(?=.*\d)"
            />
          </div>

          {generatedPassword && (
            <div>
              <Label>Generated Password</Label>
              <div className="flex space-x-2">
                <Input value={generatedPassword} readOnly className="h-8 font-mono" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopyToClipboard(generatedPassword)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Button onClick={onGeneratePassword} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              Generate
            </Button>
            {generatedPassword && (
              <Button onClick={onUseGeneratedPassword} variant="outline" className="flex-1">
                Use Password
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderVaultForm = () => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Add Vault Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="group">Group</Label>
          <Input
            id="group"
            value={formData.group}
            onChange={(e) => onFormChange('group', e.target.value)}
            className="h-8"
          />
        </div>

        <div>
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            value={formData.url}
            onChange={(e) => onFormChange('url', e.target.value)}
            className="h-8"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onFormChange('description', e.target.value)}
            className="min-h-[60px] resize-none"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <Label>Attributes</Label>
            <Button variant="outline" size="sm" onClick={onAddAttribute}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {formData.attributes.map((attr, index) => (
              <div key={index} className="flex flex-col space-y-2">
                <Input
                  placeholder="Name"
                  value={attr.name}
                  onChange={(e) => onUpdateAttribute(index, 'name', e.target.value)}
                  className="h-8"
                />
                <div className="relative">
                  <Input
                    placeholder="Value"
                    type={attr.isSecret ? 'password' : 'text'}
                    value={attr.value}
                    onChange={(e) => onUpdateAttribute(index, 'value', e.target.value)}
                    className="h-8 w-full"
                  />
                  {attr.isSecret && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-8 w-8 p-0"
                      onClick={() => onPasswordGenOpen(index)}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      checked={attr.isSecret}
                      onCheckedChange={(checked) => onUpdateAttribute(index, 'isSecret', checked as boolean)}
                    />
                    <Label className="text-xs">Secret</Label>
                  </div>
                  {formData.attributes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveAttribute(index)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onSubmitEntry} className="w-full">
          Save Entry
        </Button>
      </CardContent>
    </Card>
  );

  const renderVaultList = () => (
    <div className="space-y-3">
      <Input
        placeholder="Search entries..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9"
      />

      {vaultEntries.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No vault entries yet. Add your first entry below.
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No entries match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-3 hover:border-security-blue/50 transition-colors bg-muted/20">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-sm">{entry.group}</h4>
                  <p className="text-xs text-muted-foreground">{entry.url}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditEntry(entry.id)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </div>

              <div className="space-y-2">
                {entry.attributes.map((attr, index) => (
                  <div key={index} className="flex flex-col space-y-1 text-xs">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{attr.name}:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopyToClipboard(attr.name)}
                        className="h-4 w-4 p-0"
                      >
                        <Copy className="w-2 h-2" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className={attr.isSecret ? 'font-mono text-xs' : ''}>
                        {attr.isSecret ? '••••••••' : attr.value}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopyToClipboard(attr.value)}
                        className="h-4 w-4 p-0"
                      >
                        <Copy className="w-2 h-2" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const containerSize = popupSize 
    ? "w-samsung-s21 h-extension" 
    : "w-full min-h-screen";

  return (
    <div className={`bg-background flex items-center ${popupSize ? 'justify-center' : ''} p-4`}>
      <div className={`${containerSize} bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-col ${containerClassName}`}>
        {stage === 'disconnected' && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <div className="flex items-center space-x-3">
                <MobileVaultLogo size={48} />
                <h1 className="text-2xl font-bold text-foreground">Mobile Vault</h1>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-security-red rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">Disconnected</span>
              </div>

              <Button
                onClick={onConnect}
                className="w-32 h-12 bg-security-blue hover:bg-security-blue/90"
              >
                Connect
              </Button>
            </div>
          </div>
        )}

        {stage === 'connecting' && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="flex items-center space-x-3">
                <MobileVaultLogo size={32} />
                <h2 className="text-lg font-semibold">Connecting...</h2>
              </div>

              <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                <div className="grid grid-cols-8 gap-1 w-40 h-40">
                  {Array.from({ length: 64 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Scan this QR code with your mobile device to establish a secure connection
              </p>

              <div className="text-xs text-muted-foreground font-mono">{qrData.substring(0, 20)}...</div>
            </div>
          </div>
        )}

        {stage === 'connected' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0">
              <div className="flex items-center space-x-3">
                <MobileVaultLogo size={28} />
                <h2 className="text-lg font-semibold">Mobile Vault</h2>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-security-green rounded-full"></div>
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-4 py-4">
                {renderVaultList()}
                {renderVaultForm()}
              </div>
            </div>
          </div>
        )}
      </div>

      {showPasswordGen && renderPasswordGenerator()}
    </div>
  );
}
