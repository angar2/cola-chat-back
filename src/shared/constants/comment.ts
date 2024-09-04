export const COMMENTS = {
  SOCKET: {
    userJoined: (nickname: string) => `${nickname}님이 입장했습니다.`,
    userLeft: (nickname: string) => `${nickname}님이 퇴장했습니다.`,
  },
  RESPONSE: {
    DEFAULT: '요청이 성공적으로 처리되었습니다.',
  },
  ERROR: {
    CHAT_NOT_FOUND: '채팅방이 존재하지 않습니다.',
    CHAT_EXPIRED: '채팅이 만료되어 더 이상 사용할 수 없습니다.',
    INVALID_DATA: '요청된 데이터가 올바르지 않습니다.',
    CHATTER_NOT_FOUND: '채팅 참여자를 찾을 수 없습니다.',
  },
};
