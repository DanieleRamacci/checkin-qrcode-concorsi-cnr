from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
from datetime import datetime,  timezone
from routes.auth import login_required  # è un decoratore deve essere importato 

user_bp = Blueprint('user', __name__)

@user_bp.route('/me')
@login_required
def me():
    return jsonify({
        "user_info": session.get('user_info'),
        "access_token": session.get('access_token')
    })

@user_bp.route('/user')
@login_required
def user_page():
    return send_from_directory('static', 'user.html')
