import json

# --- 設定 ---
# 読み込むJSONファイルの名前
INPUT_JSON_FILE = 'structure.json' 
# 出力する.mcfunctionファイルの名前
OUTPUT_MCFUNCTION_FILE = 'build.mcfunction'

def convert_json_to_function():
    
    # Minecraftの構造JSONを最適化された.mcfunctionファイルに変換します。
    
    # 1. JSONファイルの読み込み
    try:
        with open(INPUT_JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f":white_check_mark: '{INPUT_JSON_FILE}' の読み込みに成功しました。")
    except FileNotFoundError:
        print(f":x: エラー: '{INPUT_JSON_FILE}' が見つかりません。")
        print("プログラムと同じフォルダにJSONファイルを置いてください。")
        return
    except json.JSONDecodeError:
        print(f":x: エラー: '{INPUT_JSON_FILE}' は有効なJSONファイルではありません。")
        return

    # 2. データの準備
    blocks_map = data.get('blocks', {})
    xyzi_data = data.get('xyzi', [])

    if not all([blocks_map, xyzi_data]):
        print(":x: エラー: JSONファイルに 'blocks' または 'xyzi' のデータがありません。")
        return

    coords_to_block = {
        (x, y, z): blocks_map[str(i)]
        for x, y, z, i in xyzi_data
    }

    # 3. 最適化とコマンド生成
    placed_coords = set()
    final_commands = []
    
    sorted_coords = sorted(coords_to_block.keys(), key=lambda c: (c[1], c[2], c[0]))

    # ▼▼▼▼▼▼▼▼▼▼▼【ここからが修正箇所です】▼▼▼▼▼▼▼▼▼▼▼

    # 正しい座標タプルをそのままループ処理するように修正
    for start_coord in sorted_coords:
        if start_coord in placed_coords:
            continue

        # 正しい座標からX, Y, Zをそれぞれ取り出す
        x_start, y_coord, z_coord = start_coord
        
        # 座標を直接使ってブロックIDを取得
        current_block_id = coords_to_block[start_coord]
        
    # ▲▲▲▲▲▲▲▲▲▲▲【ここまでが修正箇所です】▲▲▲▲▲▲▲▲▲▲▲
        
        # X軸方向に同じブロックがどこまで続くかを探す
        x_end = x_start
        while True:
            next_coord = (x_end + 1, y_coord, z_coord)
            if coords_to_block.get(next_coord) == current_block_id:
                x_end += 1
            else:
                break
        
        end_coord = (x_end, y_coord, z_coord)

        # 見つけた範囲の座標をすべて「処理済み」として記録
        for x in range(x_start, x_end + 1):
            placed_coords.add((x, y_coord, z_coord))

        if start_coord == end_coord:
            command = f"setblock {start_coord[0]} {start_coord[1]} {start_coord[2]} {current_block_id}"
        else:
            command = f"fill {start_coord[0]} {start_coord[1]} {start_coord[2]} {end_coord[0]} {end_coord[1]} {end_coord[2]} {current_block_id}"
        
        final_commands.append(command)

    # 4. ファイルへの書き出し
    with open(OUTPUT_MCFUNCTION_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(final_commands))

    print("-" * 30)
    print(" 変換が完了しました！ ")
    print(f"ブロック総数: {len(xyzi_data)}個")
    print(f"コマンド行数: {len(final_commands)}行")
    print(f"出力ファイル: '{OUTPUT_MCFUNCTION_FILE}'")

# --- プログラムの実行 ---
if __name__ == "__main__":
    convert_json_to_function()