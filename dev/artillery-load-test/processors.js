
module.exports = {
  logContentLength: (requestParams, response, context, ee, next) => {
    if (response) {
      const length = response.body.length || 0;
      // 커스텀 지표로 길이를 기록합니다.
      // Artillery는 기본적으로 'custom' 네임스페이스 아래에 이 값을 집계해줍니다.
      ee.emit('histogram', 'response_size_bytes', length);
    }
    return next();
  }
};
