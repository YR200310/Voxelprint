from flask import Flask, request, render_template, send_file
from flask_cors import CORS
import os
from convert import convert_json_to_mcfunction # 後で修正します

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    if 'file' not in request.files:
        return "ファイルが選択されていません", 400
    file = request.files['file']
    if file.filename == '':
        return "ファイルが選択されていません", 400
    if file and file.filename.endswith('.json'):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        # convert.pyの関数を呼び出す（後で引数を調整します）
        output_filepath = convert_json_to_mcfunction(filepath)
        
        return send_file(output_filepath, as_attachment=True, download_name="build.mcfunction")
    return "無効なファイル形式です。JSONファイルをアップロードしてください。", 400

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True)
