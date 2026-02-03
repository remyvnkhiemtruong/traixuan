// Middleware to check if user is logged in
const checkLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    req.session.error = 'Vui lòng đăng nhập để tiếp tục';
    res.redirect('/login');
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.session.error = 'Bạn không có quyền truy cập trang này';
    res.redirect('/');
};

module.exports = { checkLogin, checkAdmin };
