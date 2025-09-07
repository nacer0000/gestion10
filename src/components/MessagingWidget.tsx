import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users } from 'lucide-react';
import { messagingService, authService } from '../services/api';
import { normalizeApiResponse } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { Message, User } from '../types';
import toast from 'react-hot-toast';

export const MessagingWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Fermer le widget quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchMessages();
      
      // Polling pour les nouveaux messages
      const interval = setInterval(fetchMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const usersData = await authService.getUsers();
      
      const normalizedUsers = normalizeApiResponse(usersData);
      const filteredUsers = normalizedUsers
        .filter((u: any) => u.id !== user?.id)
        .map((item: any) => ({
          ...item,
          createdAt: new Date(item.date_joined || item.created_at)
        }));


      if (user?.role === 'admin') {
        // Admin peut parler avec tout le monde
        setUsers(filteredUsers);
      } else if (user?.role === 'manager') {
        // Manager peut parler avec les employés de son magasin seulement
        setUsers(filteredUsers.filter((u: any) => 
          u.role === 'employe' && u.magasin_id === user.magasin_id
        ));
      } else {
        // Employé peut parler avec les managers de son magasin seulement
        setUsers(filteredUsers.filter((u: any) => 
          u.role === 'manager' && u.magasin_id === user.magasin_id
        ));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const fetchMessages = async () => {
    try {
      const messagesData = await messagingService.getMessages();
      
      const normalizedMessages = normalizeApiResponse(messagesData);
      const formattedMessages = normalizedMessages.map((item: any) => ({
        ...item,
        id: item.id.toString(),
        sender_id: item.sender_id?.toString() || item.sender?.toString(),
        receiver_id: item.receiver_id?.toString() || item.receiver?.toString(),
        timestamp: new Date(item.timestamp)
      })) as Message[];

      setMessages(formattedMessages);

      const unread = formattedMessages.filter(msg => 
        msg.receiver_id === user?.id.toString() && !msg.read
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user) return;

    try {

      await messagingService.createMessage({
        receiver: selectedUser.id,
        content: newMessage.trim()
      });

      setNewMessage('');
      await fetchMessages(); // Recharger les messages
      toast.success('Message envoyé');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await messagingService.updateMessage(messageId, { read: true });
      await fetchMessages(); // Recharger les messages
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getConversationMessages = () => {
    if (!selectedUser || !user) return [];
    
    return messages.filter(msg => 
      (msg.sender_id === user.id.toString() && msg.receiver_id === selectedUser.id.toString()) ||
      (msg.sender_id === selectedUser.id.toString() && msg.receiver_id === user.id.toString())
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const handleUserSelect = (selectedUser: User) => {
    setSelectedUser(selectedUser);
    
    const conversationMessages = messages.filter(msg => 
      msg.sender_id === selectedUser.id.toString() && msg.receiver_id === user?.id.toString() && !msg.read
    );
    
    conversationMessages.forEach(msg => {
      markAsRead(msg.id);
    });
  };

  const getUserUnreadCount = (userId: string) => {
    return messages.filter(msg => 
      msg.sender_id === userId.toString() && msg.receiver_id === user?.id.toString() && !msg.read
    ).length;
  };

  if (!user) return null;

  return (
    <div ref={widgetRef}>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-110 z-50"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-96 h-[500px] flex flex-col transform transition-all duration-300 ease-out">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-600 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Messages</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full">
              {/* Users List */}
              <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center space-x-2 mb-2 text-xs text-gray-500">
                    <Users className="h-3 w-3" />
                    <span>
                      {user.role === 'admin' ? 'Employés' : 'Administrateurs'}
                    </span>
                  </div>
                  {users.length > 0 ? users.map((u) => {
                    const userUnreadCount = getUserUnreadCount(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleUserSelect(u)}
                        className={`w-full text-left p-2 rounded hover:bg-gray-100 transition-colors duration-200 relative ${
                          selectedUser?.id === u.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {u.prenom} {u.nom}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.email}
                        </div>
                        {userUnreadCount > 0 && (
                          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {userUnreadCount}
                          </span>
                        )}
                      </button>
                    );
                  }) : (
                    <div className="text-center text-gray-500 text-sm p-4">
                      Aucun utilisateur disponible
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                {selectedUser ? (
                  <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {getConversationMessages().length === 0 ? (
                        <div className="text-center text-gray-500 text-sm mt-8">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Aucun message</p>
                          <p>Commencez la conversation !</p>
                        </div>
                      ) : (
                        getConversationMessages().map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.sender_id === user.id.toString() ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                message.sender_id === user.id.toString()
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-900'
                              }`}
                            >
                              <p>{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.sender_id === user.id.toString() ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {message.timestamp.toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="p-3 border-t border-gray-200">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          placeholder="Tapez votre message..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Sélectionnez un utilisateur</p>
                      <p className="text-xs">pour commencer à discuter</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};