function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Handle exact path matches
    if (uri === '/admin') {
        request.uri = '/admin.html';
    } else if (uri === '/preso') {
        request.uri = '/preso.html';
    } else if (uri === '/slides') {
        request.uri = '/slides/launcher.html';
    }

    return request;
}