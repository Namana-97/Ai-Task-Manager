import { NgModule } from '@angular/core';
import { ChatPanelComponent } from './lib/chat-panel/chat-panel.component';

@NgModule({
  imports: [ChatPanelComponent],
  exports: [ChatPanelComponent]
})
export class ChatPanelModule {}

export * from './lib/models';
export { CHAT_API_BASE_URL } from './lib/tokens';
export { ChatPanelComponent } from './lib/chat-panel/chat-panel.component';
export { ChatService } from './lib/chat.service';
