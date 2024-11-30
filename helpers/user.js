module.exports.DefaultInspectorUser = DefaultInspectorUser;
function DefaultInspectorUser(inspector_user, username, osu_id) {
    let _inspector_user = inspector_user;
    if (!inspector_user || inspector_user === null || inspector_user === undefined || inspector_user?.id === null) {
        _inspector_user = {
            known_username: username,
            osu_id: osu_id,
            roles: []
        }
    }
    return _inspector_user;
}