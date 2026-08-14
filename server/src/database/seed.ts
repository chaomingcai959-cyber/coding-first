// 种子数据（一期开发/联调用）：预置账号、频道、权限关系（附录 C2：账号-频道授权关系数据层预置）
import { DataSource } from "typeorm";
import { AppUser, Channel, ChannelPermission } from "./entities";

export async function seed(ds: DataSource) {
  const users = ds.getRepository(AppUser);
  const channels = ds.getRepository(Channel);
  const perms = ds.getRepository(ChannelPermission);

  if ((await users.count()) > 0) return; // 幂等

  await users.insert([
    { id: "u-yang", account: "yang", nickname: "杨经理", role: "editor" },
    { id: "u-viewer", account: "li", nickname: "李观察", role: "viewer" },
    { id: "u-admin", account: "wang", nickname: "王管理员", role: "admin" },
  ]);

  const seedChannels: Partial<Channel>[] = [
    { name: "央视电影频道", type: "smart", category: "电影", tenant: "全国" },
    { name: "热门电视剧", type: "smart", category: "电视剧", tenant: "全国" },
    { name: "少儿动画天地", type: "smart", category: "少儿", tenant: "全国" },
    { name: "综艺娱乐", type: "smart", category: "综艺", tenant: "全国" },
    { name: "经典电影回顾", type: "linear", category: "电影", tenant: "北京" },
    { name: "地方台精选", type: "smart", category: "电视剧", tenant: "上海" },
    { name: "纪录片专区", type: "linear", category: "电影", tenant: "广东" },
    { name: "家庭影院", type: "smart", category: "电影", tenant: "全国" },
  ];
  const saved = await channels.save(seedChannels);
  // 杨经理拥有全部频道权限；李观察仅前 2 个（验证只读与越权拦截）
  await perms.insert(
    saved.flatMap((c, i) => [
      { user_id: "u-yang", channel_id: c.id },
      ...(i < 2 ? [{ user_id: "u-viewer", channel_id: c.id }] : []),
    ]),
  );
}
